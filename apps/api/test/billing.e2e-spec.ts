import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import { SubscriptionService } from "../src/modules/billing/services/subscription.service.js";
import type { PlanSummary, SubscriptionSummary } from "../src/modules/billing/billing.types.js";

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
