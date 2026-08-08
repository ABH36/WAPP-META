import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import type { Model } from "mongoose";
import request from "supertest";
import { PlatformRole, type ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import { StorageService } from "../src/infrastructure/storage/storage.service.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type {
  InvoiceSummary,
  PaymentSummary,
  PlanSummary,
  SubscriptionSummary,
  BillingHistoryEntrySummary,
} from "../src/modules/billing/billing.types.js";
import { PlatformUser } from "../src/modules/platform/schemas/platform-user.schema.js";
import type { PlatformUserDocument } from "../src/modules/platform/schemas/platform-user.schema.js";
import { PlatformPasswordService } from "../src/modules/platform/services/platform-password.service.js";
import {
  SupportTicketCategory,
  SupportTicketPriority,
} from "../src/modules/platform/schemas/support-ticket.schema.js";
import type {
  IssuedPlatformTokenPair,
  SupportTicketSummary,
} from "../src/modules/platform/platform.types.js";
import type { ListSubscriptionsForPlatformResult } from "../src/modules/billing/services/subscription.service.js";
import type { ListInvoicesForPlatformResult } from "../src/modules/billing/services/invoice.service.js";
import type { ListPaymentsForPlatformResult } from "../src/modules/billing/services/payment.service.js";
import type { PlatformBillingDashboardSnapshot } from "../src/modules/platform/services/platform-billing-dashboard.service.js";

jest.setTimeout(30_000);

/**
 * PRD-007 Volume-2 (Platform Billing Operations & Customer Support) — the
 * first Platform Administration volume that mutates real Billing state
 * (Subscriptions/Invoices/Payments), not just registry/read operations.
 * Seeds a PLATFORM_SUPER_ADMIN and a PLATFORM_SUPPORT_EXECUTIVE directly
 * via their Mongoose models (test-only setup, same as platform.e2e-spec.ts).
 */
describe("Platform Billing Operations & Customer Support (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let platformUserModel: Model<PlatformUserDocument>;
  let platformPasswordService: PlatformPasswordService;

  const runId = Date.now();
  const ownerEmail = `plat-bill-owner-${runId}@example.com`;
  const ownerMobile = `+9849${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const superAdminEmail = `plat-bill-super-${runId}@wapp.internal`;
  const superAdminPassword = "SuperSecret1";
  const executiveEmail = `plat-bill-exec-${runId}@wapp.internal`;
  const executivePassword = "ExecPassw0rd1";

  let workspaceId: string;
  let subscriptionId: string;
  let superAdminAccessToken: string;
  let executiveAccessToken: string;
  let growthPlanId: string;
  let enterprisePlanId: string;

  beforeAll(async () => {
    sentEmails = [];

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        send: jest.fn((job: SendEmailJob) => {
          sentEmails.push(job);
          return Promise.resolve();
        }),
      })
      .overrideProvider(StorageService)
      .useValue({
        generateUploadSignature: jest.fn(),
        deleteAsset: jest.fn(),
        uploadBuffer: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    platformUserModel = moduleRef.get(getModelToken(PlatformUser.name));
    platformPasswordService = moduleRef.get(PlatformPasswordService);

    await platformUserModel.create({
      fullName: "Founding Super Admin",
      email: superAdminEmail,
      passwordHash: await platformPasswordService.hash(superAdminPassword),
      role: PlatformRole.PLATFORM_SUPER_ADMIN,
      isActive: true,
    });
    await platformUserModel.create({
      fullName: "Support Executive",
      email: executiveEmail,
      passwordHash: await platformPasswordService.hash(executivePassword),
      role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
      isActive: true,
    });

    const superLoginRes = await request(server())
      .post("/api/v1/platform/auth/login")
      .send({ email: superAdminEmail, password: superAdminPassword });
    superAdminAccessToken = (
      superLoginRes.body as ApiSuccessResponse<{ tokens: IssuedPlatformTokenPair }>
    ).data.tokens.accessToken;

    const execLoginRes = await request(server())
      .post("/api/v1/platform/auth/login")
      .send({ email: executiveEmail, password: executivePassword });
    executiveAccessToken = (
      execLoginRes.body as ApiSuccessResponse<{ tokens: IssuedPlatformTokenPair }>
    ).data.tokens.accessToken;

    // A real tenant workspace with a real TRIAL Subscription.
    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Workspace Owner",
      email: ownerEmail,
      mobileNumber: ownerMobile,
      password,
    });
    const verifyToken = extractToken(extractLink(ownerEmail));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const tokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data.tokens;

    const createRes = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ name: `Platform Billing Test Co ${runId}` });
    const createBody = createRes.body as ApiSuccessResponse<{
      tokens: IssuedTokenPair;
      workspace: { id: string };
    }>;
    workspaceId = createBody.data.workspace.id;
    const tenantAccessToken = createBody.data.tokens.accessToken;

    const subRes = await request(server())
      .get("/api/v1/billing/subscription")
      .set("Authorization", `Bearer ${tenantAccessToken}`);
    subscriptionId = (subRes.body as ApiSuccessResponse<SubscriptionSummary>).data.id;

    const plansRes = await request(server())
      .get("/api/v1/billing/plans")
      .set("Authorization", `Bearer ${tenantAccessToken}`);
    const plans = (plansRes.body as ApiSuccessResponse<PlanSummary[]>).data;
    growthPlanId = plans.find((p) => p.name === "Growth")!.id;
    enterprisePlanId = plans.find((p) => p.name === "Enterprise")!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function platformAuthed(
    method: "get" | "post" | "patch" | "delete",
    path: string,
    token = superAdminAccessToken,
  ) {
    return request(server())[method](path).set("Authorization", `Bearer ${token}`);
  }

  function extractToken(link: string): string {
    return new URL(link).searchParams.get("token") ?? "";
  }

  function extractLink(to: string, category = "email-verification"): string {
    const job = sentEmails.find((email) => email.to === to && email.category === category);
    const link = job?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) {
      throw new Error(`No ${category} email found for ${to}`);
    }
    return link;
  }

  /** InvoiceGenerationListener reacts to SUBSCRIPTION_UPGRADED asynchronously (eventEmitter.emit is fire-and-forget) — poll rather than assert synchronously. */
  async function waitForInvoiceCount(min: number): Promise<InvoiceSummary[]> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/invoices?workspaceId=${workspaceId}`,
      );
      const page = (res.body as ApiSuccessResponse<ListInvoicesForPlatformResult>).data;
      if (page.items.length >= min) {
        return page.items;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for at least ${min} Invoice(s)`);
  }

  let firstInvoiceId: string;
  let secondInvoiceId: string;
  let paymentId: string;
  let ticketId: string;

  describe("Subscription Operations (§4.1)", () => {
    it("§10: rejects a trial extension beyond 90 days", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/trial`,
      ).send({ days: 91, reason: "too long" });
      expect(res.status).toBe(400);
    });

    it("§10: rejects a trial extension with no reason", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/trial`,
      ).send({ days: 10 });
      expect(res.status).toBe(400);
    });

    it("extends the trial and records Billing History", async () => {
      const before = await platformAuthed(
        "get",
        `/api/v1/platform/subscriptions/${subscriptionId}`,
      );
      const beforeTrialEndsAt = (before.body as ApiSuccessResponse<SubscriptionSummary>).data
        .trialEndsAt!;

      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/trial`,
      ).send({ days: 30, reason: "Goodwill extension" });
      expect(res.status).toBe(200);
      const updated = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;
      expect(new Date(updated.trialEndsAt!).getTime()).toBeGreaterThan(
        new Date(beforeTrialEndsAt).getTime(),
      );
    });

    it("Support Executive (MANAGE_TRIALS=NONE) is forbidden from extending a trial", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/trial`,
        executiveAccessToken,
      ).send({ days: 10, reason: "reason" });
      expect(res.status).toBe(403);
    });

    it("changes plan immediately, activating the Subscription and generating an Invoice", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/plan`,
      ).send({ planId: growthPlanId, immediate: true });
      expect(res.status).toBe(200);
      const updated = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;
      expect(updated.status).toBe("ACTIVE");
      expect(updated.planId).toBe(growthPlanId);

      const invoices = await waitForInvoiceCount(1);
      firstInvoiceId = invoices[0]!.id;
      expect(invoices[0]!.status).toBe("ISSUED");
    });

    it("lists subscriptions filtered by workspaceId", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/subscriptions?workspaceId=${workspaceId}`,
      );
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListSubscriptionsForPlatformResult>).data;
      expect(page.items.some((s) => s.id === subscriptionId)).toBe(true);
    });
  });

  describe("Payment Operations (§4.3)", () => {
    it("records a manual Payment with verified+evidenceUrl, closing the Invoice", async () => {
      const res = await platformAuthed("post", "/api/v1/platform/payments/manual").send({
        workspaceId,
        invoiceId: firstInvoiceId,
        gateway: "BANK_TRANSFER",
        gatewayReference: `REF-${runId}`,
        amount: 999,
        currency: "INR",
        outcome: "PAID",
        verified: true,
        evidenceUrl: "https://evidence.example.com/1",
      });
      expect(res.status).toBe(201);
      const payment = (res.body as ApiSuccessResponse<PaymentSummary>).data;
      expect(payment.status).toBe("PAID");
      expect(payment.verified).toBe(true);
      paymentId = payment.id;

      const invoiceRes = await platformAuthed("get", `/api/v1/platform/invoices/${firstInvoiceId}`);
      expect((invoiceRes.body as ApiSuccessResponse<InvoiceSummary>).data.status).toBe("PAID");
    });

    it("Support Executive (MANAGE_PAYMENTS=NONE) is forbidden from recording a manual Payment", async () => {
      const res = await platformAuthed(
        "post",
        "/api/v1/platform/payments/manual",
        executiveAccessToken,
      ).send({
        workspaceId,
        invoiceId: firstInvoiceId,
        gateway: "BANK_TRANSFER",
        gatewayReference: "x",
        amount: 1,
        currency: "INR",
        outcome: "PAID",
      });
      expect(res.status).toBe(403);
    });

    it("§10: rejects Refund with no reason", async () => {
      const res = await platformAuthed(
        "post",
        `/api/v1/platform/payments/${paymentId}/refund`,
      ).send({});
      expect(res.status).toBe(400);
    });

    it("refunds the Payment by id, reverting the Invoice", async () => {
      const res = await platformAuthed(
        "post",
        `/api/v1/platform/payments/${paymentId}/refund`,
      ).send({ reason: "Customer requested cancellation" });
      expect(res.status).toBe(200);
      const payment = (res.body as ApiSuccessResponse<PaymentSummary>).data;
      expect(payment.status).toBe("REFUNDED");

      const invoiceRes = await platformAuthed("get", `/api/v1/platform/invoices/${firstInvoiceId}`);
      expect((invoiceRes.body as ApiSuccessResponse<InvoiceSummary>).data.status).toBe("REFUNDED");
    });

    it("lists payments filtered by workspaceId", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/payments?workspaceId=${workspaceId}`,
      );
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListPaymentsForPlatformResult>).data;
      expect(page.items.some((p) => p.id === paymentId)).toBe(true);
    });
  });

  describe("Invoice Operations (§4.2)", () => {
    it("§9: rejects Void with no reason", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/invoices/${firstInvoiceId}/void`,
      ).send({});
      expect(res.status).toBe(400);
    });

    it("voids a second, freshly-generated ISSUED Invoice", async () => {
      // A genuine second plan change (Growth -> Enterprise) to generate a second Invoice.
      await platformAuthed("patch", `/api/v1/platform/subscriptions/${subscriptionId}/plan`).send({
        planId: enterprisePlanId,
        immediate: true,
      });
      const invoices = await waitForInvoiceCount(2);
      secondInvoiceId = invoices.find((i) => i.id !== firstInvoiceId)!.id;

      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/invoices/${secondInvoiceId}/void`,
      ).send({ reason: "Duplicate plan change" });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<InvoiceSummary>).data.status).toBe("VOID");
    });

    it("rejects voiding an Invoice that isn't ISSUED", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/invoices/${firstInvoiceId}/void`,
      ).send({ reason: "already refunded" });
      expect(res.status).toBe(400);
    });
  });

  describe("Subscription status transitions (§4.1/§9)", () => {
    it("suspends an ACTIVE Subscription (billing-cause, distinct from Volume-1's Workspace-level Suspend)", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/status`,
      ).send({ status: "SUSPENDED" });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<SubscriptionSummary>).data.status).toBe("SUSPENDED");
    });

    it("resumes (ACTIVE) a SUSPENDED Subscription", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/status`,
      ).send({ status: "ACTIVE" });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<SubscriptionSummary>).data.status).toBe("ACTIVE");
    });

    it("Support Executive (MANAGE_SUBSCRIPTIONS=NONE) is forbidden from changing status", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/status`,
        executiveAccessToken,
      ).send({ status: "SUSPENDED" });
      expect(res.status).toBe(403);
    });

    it("cancels the Subscription (terminal)", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/status`,
      ).send({ status: "CANCELLED" });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<SubscriptionSummary>).data.status).toBe("CANCELLED");
    });

    it("rejects an invalid status value", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/subscriptions/${subscriptionId}/status`,
      ).send({ status: "TRIAL" });
      expect(res.status).toBe(400);
    });
  });

  describe("Billing Dashboard (§4.7)", () => {
    it("aggregates all 6 metrics", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/billing/dashboard");
      expect(res.status).toBe(200);
      const snapshot = (res.body as ApiSuccessResponse<PlatformBillingDashboardSnapshot>).data;
      expect(typeof snapshot.activeSubscriptions).toBe("number");
      expect(snapshot.trialExtensions).toBeGreaterThanOrEqual(1);
      expect(snapshot.refundRequests).toBeGreaterThanOrEqual(1);
      expect(snapshot.manualPayments).toBeGreaterThanOrEqual(1);
    });

    it("Support Executive can view the dashboard (VIEW_PLATFORM_BILLING=FULL)", async () => {
      const res = await platformAuthed(
        "get",
        "/api/v1/platform/billing/dashboard",
        executiveAccessToken,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Customer Support — Recent Activity (§4.5)", () => {
    it("composes recent Billing History for a workspace", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/billing/history?workspaceId=${workspaceId}`,
      );
      expect(res.status).toBe(200);
      const entries = (res.body as ApiSuccessResponse<BillingHistoryEntrySummary[]>).data;
      expect(entries.some((e) => e.eventType.includes("trial_extended"))).toBe(true);
      expect(entries.some((e) => e.eventType.includes("invoice_voided"))).toBe(true);
    });
  });

  describe("Support Tickets (§4.6)", () => {
    it("creates a ticket (Support Executive, MANAGE_SUPPORT=FULL)", async () => {
      const res = await platformAuthed(
        "post",
        "/api/v1/platform/support/tickets",
        executiveAccessToken,
      ).send({
        workspaceId,
        title: "Question about my invoice",
        category: SupportTicketCategory.BILLING,
        priority: SupportTicketPriority.MEDIUM,
      });
      expect(res.status).toBe(201);
      const ticket = (res.body as ApiSuccessResponse<SupportTicketSummary>).data;
      expect(ticket.status).toBe("OPEN");
      ticketId = ticket.id;
    });

    it("lists tickets filtered by workspaceId", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/support/tickets?workspaceId=${workspaceId}`,
        executiveAccessToken,
      );
      expect(res.status).toBe(200);
      const tickets = (res.body as ApiSuccessResponse<SupportTicketSummary[]>).data;
      expect(tickets.some((t) => t.id === ticketId)).toBe(true);
    });

    it("rejects resolving without a resolution", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/support/tickets/${ticketId}`,
        executiveAccessToken,
      ).send({ status: "RESOLVED" });
      expect(res.status).toBe(400);
    });

    it("moves the ticket through IN_PROGRESS to RESOLVED with a resolution", async () => {
      await platformAuthed(
        "patch",
        `/api/v1/platform/support/tickets/${ticketId}`,
        executiveAccessToken,
      ).send({ status: "IN_PROGRESS", assignedOperator: "op-self" });

      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/support/tickets/${ticketId}`,
        executiveAccessToken,
      ).send({ status: "RESOLVED", resolution: "Explained the invoice line items." });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<SupportTicketSummary>).data.status).toBe("RESOLVED");
    });

    it("closes the ticket, then rejects further modification", async () => {
      const closeRes = await platformAuthed(
        "patch",
        `/api/v1/platform/support/tickets/${ticketId}`,
        executiveAccessToken,
      ).send({ status: "CLOSED" });
      expect(closeRes.status).toBe(200);

      const reopenRes = await platformAuthed(
        "patch",
        `/api/v1/platform/support/tickets/${ticketId}`,
        executiveAccessToken,
      ).send({ status: "OPEN" });
      expect(reopenRes.status).toBe(400);
    });
  });
});
