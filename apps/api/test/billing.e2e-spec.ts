import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { Server } from "http";
import request from "supertest";
import { PaymentStatus, UsageCounterType, type ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import type { CustomerSummary } from "../src/modules/crm/crm.types.js";
import { SubscriptionService } from "../src/modules/billing/services/subscription.service.js";
import { InvoiceService } from "../src/modules/billing/services/invoice.service.js";
import { PlanLimits } from "../src/modules/billing/schemas/plan-limits.schema.js";
import type { PlanLimitsDocument } from "../src/modules/billing/schemas/plan-limits.schema.js";
import type {
  EntitlementsSummary,
  InvoiceSummary,
  PaymentSummary,
  PlanLimitsSummary,
  PlanSummary,
  SubscriptionSummary,
  UsageHistoryEntrySummary,
  UsageSummary,
} from "../src/modules/billing/billing.types.js";

/**
 * Covers Phase-6 Part-1 (PRD-005 Volume-1, Subscription & Plans) end-to-end
 * against the real replica-set Mongo: reactive trial creation on Workspace
 * creation (WORKSPACE_CREATED -> WorkspaceCreatedListener), Plan seeding,
 * immediate Upgrade (including the TRIAL->ACTIVE conversion path), queued
 * Downgrade, Cancellation, Workspace.status synchronization, and the
 * BILLING_ACCESS permission (already-scaffolded, reused as-is). The
 * lifecycle sweep itself (hourly BullMQ job) is exercised by calling
 * SubscriptionService's sweep methods directly against the real DB via the
 * DI container — the same "grab a real, Mongo-backed instance from
 * moduleRef" approach already used elsewhere in this suite to seed data
 * (PhoneNumberRepository etc.), avoiding an impractical real-time wait.
 */
describe("Billing — Subscription & Plans (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let subscriptionService: SubscriptionService;

  const runId = Date.now();
  const ownerEmail = `billing-owner-${runId}@example.com`;
  const ownerMobile = `+9619${String(runId).slice(-8)}`;
  const execEmail = `billing-exec-${runId}@example.com`;
  const execMobile = `+9629${String(runId).slice(-8)}`;
  const adminEmail = `billing-admin-${runId}@example.com`;
  const adminMobile = `+9639${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

  let workspaceId: string;
  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;
  let administratorAccessToken: string;
  let plans: PlanSummary[];

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
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    subscriptionService = moduleRef.get(SubscriptionService);

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Billing Owner",
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
      .send({ name: "Billing Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    ownerAccessToken = createBody.data.tokens.accessToken;

    salesExecutiveAccessToken = await inviteAndAccept(
      execEmail,
      execMobile,
      "Exec",
      "SALES_EXECUTIVE",
    );
    administratorAccessToken = await inviteAndAccept(
      adminEmail,
      adminMobile,
      "Admin",
      "ADMINISTRATOR",
    );

    const plansRes = await authed("get", "/api/v1/billing/plans");
    plans = (plansRes.body as ApiSuccessResponse<PlanSummary[]>).data;
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(method: "get" | "post" | "patch", path: string, token = ownerAccessToken) {
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

  async function inviteAndAccept(
    email: string,
    mobileNumber: string,
    fullName: string,
    role: string,
  ): Promise<string> {
    await request(server()).post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const verifyToken = extractToken(extractLink(email));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const memberTokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    await authed("post", "/api/v1/team/invitations").send({ email, role });
    const inviteToken = extractToken(extractLink(email, "team-invitation"));
    const acceptRes = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: inviteToken });
    const acceptBody = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;

    return acceptBody.tokens.accessToken;
  }

  it("seeds exactly the three approved Plans with null pricing (GTM pricing not yet approved)", () => {
    const names = plans.map((p) => p.name).sort();
    expect(names).toEqual(["Enterprise", "Growth", "Starter"]);
    for (const plan of plans) {
      expect(plan.monthlyPrice).toBeNull();
      expect(plan.yearlyPrice).toBeNull();
    }
  });

  it("creates a TRIAL Subscription reactively when the Workspace is created", async () => {
    const res = await authed("get", "/api/v1/billing/subscription");
    expect(res.status).toBe(200);
    const subscription = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;

    expect(subscription.workspaceId).toBe(workspaceId);
    expect(subscription.status).toBe("TRIAL");
    const starter = plans.find((p) => p.name === "Starter")!;
    expect(subscription.planId).toBe(starter.id);
    expect(subscription.trialEndsAt).not.toBeNull();

    const workspaceRes = await authed("get", "/api/v1/workspaces/me");
    expect((workspaceRes.body as ApiSuccessResponse<WorkspaceProfile>).data.status).toBe("TRIAL");
  });

  it("rejects an invalid Plan on upgrade", async () => {
    const res = await authed("post", "/api/v1/billing/subscription/upgrade").send({
      planId: "000000000000000000000000",
    });
    expect(res.status).toBe(400);
  });

  it("upgrades immediately, converting TRIAL to ACTIVE and syncing Workspace.status", async () => {
    const growth = plans.find((p) => p.name === "Growth")!;
    const res = await authed("post", "/api/v1/billing/subscription/upgrade").send({
      planId: growth.id,
    });

    expect(res.status).toBe(201);
    const subscription = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.planId).toBe(growth.id);

    const workspaceRes = await authed("get", "/api/v1/workspaces/me");
    expect((workspaceRes.body as ApiSuccessResponse<WorkspaceProfile>).data.status).toBe("ACTIVE");
  });

  it("queues a downgrade without applying it immediately", async () => {
    const starter = plans.find((p) => p.name === "Starter")!;
    const res = await authed("post", "/api/v1/billing/subscription/downgrade").send({
      planId: starter.id,
    });

    expect(res.status).toBe(201);
    const subscription = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;
    expect(subscription.pendingPlanId).toBe(starter.id);
    // The active plan itself hasn't changed yet.
    const growth = plans.find((p) => p.name === "Growth")!;
    expect(subscription.planId).toBe(growth.id);
  });

  it("applies the queued downgrade once renewalDate is reached (sweep, invoked directly against the real DB)", async () => {
    const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    const applied = await subscriptionService.applyDuePendingDowngrades(future);
    expect(applied).toBeGreaterThanOrEqual(1);

    const res = await authed("get", "/api/v1/billing/subscription");
    const subscription = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;
    const starter = plans.find((p) => p.name === "Starter")!;
    expect(subscription.planId).toBe(starter.id);
    expect(subscription.pendingPlanId).toBeNull();
  });

  it("Sales Executive (no BILLING_ACCESS) is forbidden; Administrator (VIEW_ONLY) can still view", async () => {
    const execRes = await authed("get", "/api/v1/billing/subscription", salesExecutiveAccessToken);
    expect(execRes.status).toBe(403);

    const adminRes = await authed("get", "/api/v1/billing/subscription", administratorAccessToken);
    expect(adminRes.status).toBe(200);
  });

  it("has no /renew endpoint (deferred to Volume-2, resolved 2026-08-07)", async () => {
    const res = await authed("post", "/api/v1/billing/subscription/renew");
    expect(res.status).toBe(404);
  });

  it("cancels the Subscription, preserves it as a historical record, and syncs Workspace to CANCELLED", async () => {
    const res = await authed("post", "/api/v1/billing/subscription/cancel");
    expect(res.status).toBe(201);
    const subscription = (res.body as ApiSuccessResponse<SubscriptionSummary>).data;
    expect(subscription.status).toBe("CANCELLED");
    expect(subscription.cancelledAt).not.toBeNull();

    const workspaceRes = await authed("get", "/api/v1/workspaces/me");
    expect((workspaceRes.body as ApiSuccessResponse<WorkspaceProfile>).data.status).toBe(
      "CANCELLED",
    );

    const getRes = await authed("get", "/api/v1/billing/subscription");
    expect(getRes.status).toBe(200);

    const cancelAgainRes = await authed("post", "/api/v1/billing/subscription/cancel");
    expect(cancelAgainRes.status).toBe(400);
  });

  it("rejects plan changes once CANCELLED", async () => {
    const growth = plans.find((p) => p.name === "Growth")!;
    const res = await authed("post", "/api/v1/billing/subscription/upgrade").send({
      planId: growth.id,
    });
    expect(res.status).toBe(400);
  });
});

describe("Billing — lifecycle sweep against a fresh Workspace (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let subscriptionService: SubscriptionService;
  let ownerAccessToken: string;

  const runId = Date.now();
  const ownerEmail = `billing-sweep-owner-${runId}@example.com`;
  const ownerMobile = `+9649${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

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
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    subscriptionService = moduleRef.get(SubscriptionService);

    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Sweep Owner",
        email: ownerEmail,
        mobileNumber: ownerMobile,
        password,
      });
    const verifyLink = sentEmails
      .find((e) => e.to === ownerEmail && e.category === "email-verification")
      ?.html.match(/href="([^"]+)"/)?.[1];
    const verifyToken = new URL(verifyLink!).searchParams.get("token") ?? "";
    const verifyRes = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const tokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data.tokens;

    const createRes = await request(app.getHttpServer() as Server)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ name: "Sweep Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>;
    ownerAccessToken = createBody.data.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(path: string) {
    return request(server()).get(path).set("Authorization", `Bearer ${ownerAccessToken}`);
  }

  it("moves an expired Trial into Grace Period, then Suspended, syncing Workspace to EXPIRED throughout (never WorkspaceStatus.SUSPENDED)", async () => {
    const pastTrialEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const movedToGrace =
      await subscriptionService.expireLapsedTrialsAndActiveSubscriptions(pastTrialEnd);
    expect(movedToGrace).toBeGreaterThanOrEqual(1);

    const afterGraceRes = await authed("/api/v1/billing/subscription");
    const afterGrace = (afterGraceRes.body as ApiSuccessResponse<SubscriptionSummary>).data;
    expect(afterGrace.status).toBe("GRACE_PERIOD");
    expect(afterGrace.graceEndsAt).not.toBeNull();

    const workspaceAfterGraceRes = await authed("/api/v1/workspaces/me");
    expect((workspaceAfterGraceRes.body as ApiSuccessResponse<WorkspaceProfile>).data.status).toBe(
      "EXPIRED",
    );

    const pastGraceEnd = new Date(pastTrialEnd.getTime() + 10 * 24 * 60 * 60 * 1000);
    const suspendedCount = await subscriptionService.suspendExpiredGracePeriods(pastGraceEnd);
    expect(suspendedCount).toBeGreaterThanOrEqual(1);

    const afterSuspendRes = await authed("/api/v1/billing/subscription");
    expect((afterSuspendRes.body as ApiSuccessResponse<SubscriptionSummary>).data.status).toBe(
      "SUSPENDED",
    );

    const workspaceAfterSuspendRes = await authed("/api/v1/workspaces/me");
    expect(
      (workspaceAfterSuspendRes.body as ApiSuccessResponse<WorkspaceProfile>).data.status,
    ).toBe("EXPIRED");
  });
});

/**
 * Covers Phase-6 Part-2 (PRD-005 Volume-2, Invoices & Payments) end-to-end
 * against the real replica-set Mongo: internally-triggered Invoice
 * generation on SUBSCRIPTION_UPGRADED, manual Payment recording (PAID and
 * FAILED outcomes), the Owner-only restriction on POST
 * /billing/payments|refunds (TD-010 — narrower than BILLING_ACCESS alone),
 * Duplicate/Invalid-Amount/Invalid-Currency/Invalid-Invoice-Status
 * validation, Refund closing both Payment and Invoice, and the overdue
 * sweep (invoked directly against the real DB via the DI container, same
 * "grab a real instance from moduleRef" approach the Subscription lifecycle
 * sweep tests already use above).
 */
describe("Billing — Invoices & Payments (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let invoiceService: InvoiceService;

  const runId = Date.now();
  const ownerEmail = `billing-inv-owner-${runId}@example.com`;
  const ownerMobile = `+9659${String(runId).slice(-8)}`;
  const execEmail = `billing-inv-exec-${runId}@example.com`;
  const execMobile = `+9669${String(runId).slice(-8)}`;
  const adminEmail = `billing-inv-admin-${runId}@example.com`;
  const adminMobile = `+9679${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

  let workspaceId: string;
  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;
  let administratorAccessToken: string;
  let plans: PlanSummary[];
  let firstInvoiceId: string;

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
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    invoiceService = moduleRef.get(InvoiceService);

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Billing Invoice Owner",
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
      .send({ name: "Billing Invoice Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    ownerAccessToken = createBody.data.tokens.accessToken;

    salesExecutiveAccessToken = await inviteAndAccept(
      execEmail,
      execMobile,
      "Exec",
      "SALES_EXECUTIVE",
    );
    administratorAccessToken = await inviteAndAccept(
      adminEmail,
      adminMobile,
      "Admin",
      "ADMINISTRATOR",
    );

    const plansRes = await authed("get", "/api/v1/billing/plans");
    plans = (plansRes.body as ApiSuccessResponse<PlanSummary[]>).data;

    // Every successful upgrade() call generates exactly one Invoice
    // (InvoiceGenerationListener on SUBSCRIPTION_UPGRADED) — this also
    // converts TRIAL -> ACTIVE, the same path already covered in the
    // Subscription suite above.
    const growth = plans.find((p) => p.name === "Growth")!;
    await authed("post", "/api/v1/billing/subscription/upgrade").send({ planId: growth.id });

    const invoices = await waitForInvoiceCount(1);
    firstInvoiceId = invoices[0]!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(method: "get" | "post" | "patch", path: string, token = ownerAccessToken) {
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

  async function inviteAndAccept(
    email: string,
    mobileNumber: string,
    fullName: string,
    role: string,
  ): Promise<string> {
    await request(server()).post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const verifyToken = extractToken(extractLink(email));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const memberTokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    await authed("post", "/api/v1/team/invitations").send({ email, role });
    const inviteToken = extractToken(extractLink(email, "team-invitation"));
    const acceptRes = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: inviteToken });
    const acceptBody = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;

    return acceptBody.tokens.accessToken;
  }

  /**
   * Invoice generation is InvoiceGenerationListener reacting to
   * SUBSCRIPTION_UPGRADED — eventEmitter.emit() is fire-and-forget (not
   * emitAsync), same as every other domain event in this codebase (e.g.
   * WorkspaceCreatedListener's reactive trial creation), so the Invoice
   * isn't guaranteed to exist the instant the upgrade HTTP response
   * returns. Polls rather than asserting synchronous completion.
   */
  async function waitForInvoiceCount(min: number): Promise<InvoiceSummary[]> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await authed("get", "/api/v1/billing/invoices");
      const invoices = (res.body as ApiSuccessResponse<InvoiceSummary[]>).data;
      if (invoices.length >= min) {
        return invoices;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for at least ${min} Invoice(s)`);
  }

  it("generates an ISSUED Invoice internally on upgrade, with null amount (Plan pricing not yet approved)", async () => {
    const res = await authed("get", `/api/v1/billing/invoices/${firstInvoiceId}`);
    expect(res.status).toBe(200);
    const invoice = (res.body as ApiSuccessResponse<InvoiceSummary>).data;
    expect(invoice.workspaceId).toBe(workspaceId);
    expect(invoice.status).toBe("ISSUED");
    expect(invoice.amount).toBeNull();
    expect(invoice.invoiceNumber).toMatch(/^INV-/);
  });

  it("Sales Executive (no BILLING_ACCESS) is forbidden from viewing Invoices; Administrator (VIEW_ONLY) can view", async () => {
    const execRes = await authed("get", "/api/v1/billing/invoices", salesExecutiveAccessToken);
    expect(execRes.status).toBe(403);

    const adminRes = await authed("get", "/api/v1/billing/invoices", administratorAccessToken);
    expect(adminRes.status).toBe(200);
  });

  it("rejects an unknown Invoice id with 404", async () => {
    const res = await authed("get", "/api/v1/billing/invoices/000000000000000000000000");
    expect(res.status).toBe(404);
  });

  it("Administrator (VIEW_ONLY, not Owner) is forbidden from recording a Payment (TD-010 interim restriction)", async () => {
    const res = await authed("post", "/api/v1/billing/payments", administratorAccessToken).send({
      invoiceId: firstInvoiceId,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-ADMIN-1",
      amount: 999,
      currency: "INR",
      outcome: "PAID",
    });
    expect(res.status).toBe(403);
  });

  it("rejects Invalid Amount and Invalid Currency", async () => {
    const invalidAmountRes = await authed("post", "/api/v1/billing/payments").send({
      invoiceId: firstInvoiceId,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-2",
      amount: 0,
      currency: "INR",
      outcome: "PAID",
    });
    expect(invalidAmountRes.status).toBe(400);

    const invalidCurrencyRes = await authed("post", "/api/v1/billing/payments").send({
      invoiceId: firstInvoiceId,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-3",
      amount: 999,
      currency: "USD",
      outcome: "PAID",
    });
    expect(invalidCurrencyRes.status).toBe(400);
  });

  it("Owner records a PAID Payment, closing the Invoice", async () => {
    const res = await authed("post", "/api/v1/billing/payments").send({
      invoiceId: firstInvoiceId,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-4",
      amount: 999,
      currency: "INR",
      outcome: "PAID",
    });
    expect(res.status).toBe(201);
    const payment = (res.body as ApiSuccessResponse<PaymentSummary>).data;
    expect(payment.status).toBe("PAID");

    const invoiceRes = await authed("get", `/api/v1/billing/invoices/${firstInvoiceId}`);
    expect((invoiceRes.body as ApiSuccessResponse<InvoiceSummary>).data.status).toBe("PAID");
  });

  it("rejects a second Payment attempt against an already-PAID Invoice (Duplicate Payment / Invalid Invoice Status)", async () => {
    const res = await authed("post", "/api/v1/billing/payments").send({
      invoiceId: firstInvoiceId,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-5",
      amount: 999,
      currency: "INR",
      outcome: "PAID",
    });
    expect(res.status).toBe(400);
  });

  it("records a FAILED Payment on a fresh Invoice without closing it, allowing a subsequent retry", async () => {
    // A second upgrade() call generates a second Invoice.
    const starter = plans.find((p) => p.name === "Starter")!;
    await authed("post", "/api/v1/billing/subscription/upgrade").send({ planId: starter.id });
    const invoices = await waitForInvoiceCount(2);
    const secondInvoice = invoices.find((i) => i.id !== firstInvoiceId)!;

    const failedRes = await authed("post", "/api/v1/billing/payments").send({
      invoiceId: secondInvoice.id,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-FAIL-1",
      amount: 999,
      currency: "INR",
      outcome: "FAILED",
    });
    expect(failedRes.status).toBe(201);
    expect((failedRes.body as ApiSuccessResponse<PaymentSummary>).data.status).toBe("FAILED");

    const stillIssuedRes = await authed("get", `/api/v1/billing/invoices/${secondInvoice.id}`);
    expect((stillIssuedRes.body as ApiSuccessResponse<InvoiceSummary>).data.status).toBe("ISSUED");

    // A retry (new Payment attempt) against the same still-ISSUED Invoice succeeds.
    const retryRes = await authed("post", "/api/v1/billing/payments").send({
      invoiceId: secondInvoice.id,
      gateway: "BANK_TRANSFER",
      gatewayReference: "REF-RETRY-1",
      amount: 999,
      currency: "INR",
      outcome: "PAID",
    });
    expect(retryRes.status).toBe(201);
    expect((retryRes.body as ApiSuccessResponse<PaymentSummary>).data.status).toBe("PAID");
  });

  it("refunds a PAID Payment, reverting the Invoice to REFUNDED, and rejects a second refund", async () => {
    const paymentsRes = await authed("get", "/api/v1/billing/payments");
    const paidPayment = (paymentsRes.body as ApiSuccessResponse<PaymentSummary[]>).data.find(
      (p) => p.invoiceId === firstInvoiceId && p.status === PaymentStatus.PAID,
    )!;

    const refundRes = await authed("post", "/api/v1/billing/refunds").send({
      paymentId: paidPayment.id,
    });
    expect(refundRes.status).toBe(201);
    expect((refundRes.body as ApiSuccessResponse<PaymentSummary>).data.status).toBe("REFUNDED");

    const invoiceRes = await authed("get", `/api/v1/billing/invoices/${firstInvoiceId}`);
    expect((invoiceRes.body as ApiSuccessResponse<InvoiceSummary>).data.status).toBe("REFUNDED");

    const secondRefundRes = await authed("post", "/api/v1/billing/refunds").send({
      paymentId: paidPayment.id,
    });
    expect(secondRefundRes.status).toBe(400);
  });

  it("flags an overdue Invoice exactly once (sweep invoked directly against the real DB)", async () => {
    // A third upgrade generates a fresh Invoice, due 7 days from issue.
    const growth = plans.find((p) => p.name === "Growth")!;
    await authed("post", "/api/v1/billing/subscription/upgrade").send({ planId: growth.id });
    await waitForInvoiceCount(3);

    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const flaggedFirstPass = await invoiceService.flagOverdueInvoices(future);
    expect(flaggedFirstPass).toBeGreaterThanOrEqual(1);

    // Idempotent: a second pass at the same (or later) time doesn't re-flag it.
    const flaggedSecondPass = await invoiceService.flagOverdueInvoices(
      new Date(future.getTime() + 60 * 60 * 1000),
    );
    expect(flaggedSecondPass).toBe(0);
  });
});

/**
 * Covers Phase-6 Part-3 (PRD-005 Volume-3, Usage, Limits & Enforcement)
 * end-to-end against the real replica-set Mongo: the 4 read-only endpoints,
 * event-driven counter increments (via real CRM Customer creation), the
 * BILLING_ACCESS permission, and — since every seeded PlanLimits document
 * has null limits by default (TD-014) — threshold/exceeded/locked/plan-
 * change-diff behavior is exercised by directly setting a real limit on
 * Starter's PlanLimits document via the Mongoose model (test-only setup,
 * same "grab a real instance from moduleRef" approach the Subscription
 * lifecycle sweep tests already use above), then driving real API calls
 * against it.
 */
describe("Billing — Usage, Limits & Enforcement (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let planLimitsModel: Model<PlanLimitsDocument>;

  const runId = Date.now();
  const ownerEmail = `billing-usage-owner-${runId}@example.com`;
  const ownerMobile = `+9689${String(runId).slice(-8)}`;
  const execEmail = `billing-usage-exec-${runId}@example.com`;
  const execMobile = `+9699${String(runId).slice(-8)}`;
  const adminEmail = `billing-usage-admin-${runId}@example.com`;
  const adminMobile = `+9609${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;
  let administratorAccessToken: string;
  let plans: PlanSummary[];
  let starterPlanId: string;
  let growthPlanId: string;

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
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    planLimitsModel = moduleRef.get(getModelToken(PlanLimits.name));

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Billing Usage Owner",
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
      .send({ name: "Billing Usage Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>;
    ownerAccessToken = createBody.data.tokens.accessToken;

    salesExecutiveAccessToken = await inviteAndAccept(
      execEmail,
      execMobile,
      "Exec",
      "SALES_EXECUTIVE",
    );
    administratorAccessToken = await inviteAndAccept(
      adminEmail,
      adminMobile,
      "Admin",
      "ADMINISTRATOR",
    );

    const plansRes = await authed("get", "/api/v1/billing/plans");
    plans = (plansRes.body as ApiSuccessResponse<PlanSummary[]>).data;
    starterPlanId = plans.find((p) => p.name === "Starter")!.id;
    growthPlanId = plans.find((p) => p.name === "Growth")!.id;

    // Test-only setup: real limits, since every seeded PlanLimits is null
    // by default (TD-014) — Starter gets a tight Customers limit and no
    // Automation; Growth gets a looser limit and Automation enabled, to
    // exercise the threshold/exceeded/locked and plan-change-diff paths.
    await planLimitsModel.updateOne(
      { planId: starterPlanId },
      { $set: { customersLimit: 3, automationEnabled: false } },
    );
    await planLimitsModel.updateOne(
      { planId: growthPlanId },
      { $set: { customersLimit: 100, automationEnabled: true } },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(method: "get" | "post" | "patch", path: string, token = ownerAccessToken) {
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

  async function inviteAndAccept(
    email: string,
    mobileNumber: string,
    fullName: string,
    role: string,
  ): Promise<string> {
    await request(server()).post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const verifyToken = extractToken(extractLink(email));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const memberTokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    await authed("post", "/api/v1/team/invitations").send({ email, role });
    const inviteToken = extractToken(extractLink(email, "team-invitation"));
    const acceptRes = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: inviteToken });
    const acceptBody = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;

    return acceptBody.tokens.accessToken;
  }

  async function createCustomer(mobileSuffix: string): Promise<CustomerSummary> {
    const res = await authed("post", "/api/v1/crm/customers").send({
      customerName: `Usage Test Customer ${mobileSuffix}`,
      mobileNumber: `+9611${mobileSuffix}`,
    });
    expect(res.status).toBe(201);
    return (res.body as ApiSuccessResponse<CustomerSummary>).data;
  }

  /** Event-driven counters are fire-and-forget (eventEmitter.emit) — same eventual-consistency reasoning as Invoice generation (Volume-2). */
  async function waitForCustomersCount(min: number): Promise<UsageSummary> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await authed("get", "/api/v1/billing/usage");
      const usage = (res.body as ApiSuccessResponse<UsageSummary>).data;
      const customers = usage.counters.find((c) => c.counterType === UsageCounterType.CUSTOMERS);
      if (customers && customers.count >= min) {
        return usage;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for Customers count >= ${min}`);
  }

  async function waitForHistoryEventType(eventType: string): Promise<UsageHistoryEntrySummary[]> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await authed("get", "/api/v1/billing/usage/history");
      const entries = (res.body as ApiSuccessResponse<UsageHistoryEntrySummary[]>).data;
      if (entries.some((e) => e.eventType === eventType)) {
        return entries;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for a Usage History entry of type ${eventType}`);
  }

  it("GET /billing/limits reflects the real limit set on Starter (entitlements otherwise default true)", async () => {
    const res = await authed("get", "/api/v1/billing/limits");
    expect(res.status).toBe(200);
    const limits = (res.body as ApiSuccessResponse<PlanLimitsSummary>).data;
    expect(limits.planId).toBe(starterPlanId);
    expect(limits.limits.customers).toBe(3);
    expect(limits.entitlements.automation).toBe(false);
    expect(limits.entitlements.crm).toBe(true);
  });

  it("GET /billing/entitlements returns just the boolean flags", async () => {
    const res = await authed("get", "/api/v1/billing/entitlements");
    expect(res.status).toBe(200);
    const entitlements = (res.body as ApiSuccessResponse<EntitlementsSummary>).data;
    expect(entitlements.automation).toBe(false);
    expect(entitlements.reports).toBe(true);
  });

  it("GET /billing/usage returns all 9 counters, with deferred ones (Campaigns/Storage/API Requests) at limit null", async () => {
    const res = await authed("get", "/api/v1/billing/usage");
    expect(res.status).toBe(200);
    const usage = (res.body as ApiSuccessResponse<UsageSummary>).data;
    expect(usage.counters).toHaveLength(9);
    const campaigns = usage.counters.find((c) => c.counterType === UsageCounterType.CAMPAIGNS)!;
    expect(campaigns.limit).toBeNull();
  });

  it("Sales Executive (no BILLING_ACCESS) is forbidden; Administrator (VIEW_ONLY) can view all 4 endpoints", async () => {
    for (const path of ["usage", "limits", "entitlements", "usage/history"]) {
      const execRes = await authed("get", `/api/v1/billing/${path}`, salesExecutiveAccessToken);
      expect(execRes.status).toBe(403);

      const adminRes = await authed("get", `/api/v1/billing/${path}`, administratorAccessToken);
      expect(adminRes.status).toBe(200);
    }
  });

  it("increments the Customers counter reactively as real Customers are created via the CRM API", async () => {
    await createCustomer("00001");
    const usage = await waitForCustomersCount(1);
    const customers = usage.counters.find((c) => c.counterType === UsageCounterType.CUSTOMERS)!;
    expect(customers.count).toBe(1);
    expect(customers.limit).toBe(3);
    expect(customers.locked).toBe(false);
  });

  it("reaches the 100% warning threshold at the limit without being locked, then exceeds and locks on the next creation", async () => {
    // Starter's customersLimit is 3; one Customer already exists from the
    // previous test, so two more reaches exactly 3 (100%, a warning, not
    // yet a rejection — §8 resolved 2026-08-07).
    await createCustomer("00002");
    await createCustomer("00003");
    const atLimit = await waitForCustomersCount(3);
    const atLimitCounter = atLimit.counters.find(
      (c) => c.counterType === UsageCounterType.CUSTOMERS,
    )!;
    expect(atLimitCounter.count).toBe(3);
    expect(atLimitCounter.locked).toBe(false);
    await waitForHistoryEventType("billing.usage_threshold_reached");

    // The 4th Customer pushes usage to 4 > 3 — now exceeded and locked.
    // Waiting for the WORKSPACE_LOCKED history entry (not just the count)
    // guarantees setLocked()'s write already completed: recordCreation()
    // awaits setLocked() before emitting WORKSPACE_LOCKED, and the history
    // listener only writes its entry after receiving that same emit.
    await createCustomer("00004");
    await waitForCustomersCount(4);
    await waitForHistoryEventType("billing.usage_limit_exceeded");
    await waitForHistoryEventType("billing.workspace_locked");

    const overLimitRes = await authed("get", "/api/v1/billing/usage");
    const overLimit = (overLimitRes.body as ApiSuccessResponse<UsageSummary>).data;
    const overLimitCounter = overLimit.counters.find(
      (c) => c.counterType === UsageCounterType.CUSTOMERS,
    )!;
    expect(overLimitCounter.count).toBe(4);
    expect(overLimitCounter.locked).toBe(true);
  });

  it("upgrading to a Plan with a higher limit and a newly-granted feature unlocks Customers and enables Automation", async () => {
    const res = await authed("post", "/api/v1/billing/subscription/upgrade").send({
      planId: growthPlanId,
    });
    expect(res.status).toBe(201);

    await waitForHistoryEventType("billing.workspace_unlocked");
    await waitForHistoryEventType("billing.feature_enabled");

    const limitsRes = await authed("get", "/api/v1/billing/limits");
    const limits = (limitsRes.body as ApiSuccessResponse<PlanLimitsSummary>).data;
    expect(limits.planId).toBe(growthPlanId);
    expect(limits.entitlements.automation).toBe(true);

    const usageRes = await authed("get", "/api/v1/billing/usage");
    const usage = (usageRes.body as ApiSuccessResponse<UsageSummary>).data;
    const customers = usage.counters.find((c) => c.counterType === UsageCounterType.CUSTOMERS)!;
    expect(customers.locked).toBe(false);
    expect(customers.limit).toBe(100);
  });
});
