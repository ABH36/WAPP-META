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
import { PlatformUser } from "../src/modules/platform/schemas/platform-user.schema.js";
import type { PlatformUserDocument } from "../src/modules/platform/schemas/platform-user.schema.js";
import { PlatformPasswordService } from "../src/modules/platform/services/platform-password.service.js";
import type {
  InvestigationTimelineEntry,
  IssuedPlatformTokenPair,
  PlatformAuditEntrySummary,
  SupportSessionSummary,
  SupportWorkspaceOverview,
} from "../src/modules/platform/platform.types.js";
import type { ListSupportSessionsResult } from "../src/modules/platform/services/platform-support-sessions.service.js";
import type { ListPlatformAuditResult } from "../src/modules/platform/services/platform-audit.service.js";

jest.setTimeout(30_000);

/**
 * PRD-007 Volume-3 (Platform Support, Break-Glass Access & Global Audit) —
 * the first Platform Administration volume with a real authorization
 * boundary gating cross-tenant reads (SupportSessionGuard). Seeds a
 * PLATFORM_SUPER_ADMIN and a PLATFORM_SUPPORT_EXECUTIVE directly via their
 * Mongoose models (test-only setup, same as platform.e2e-spec.ts).
 */
describe("Platform Support, Break-Glass Access & Global Audit (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let platformUserModel: Model<PlatformUserDocument>;
  let platformPasswordService: PlatformPasswordService;

  const runId = Date.now();
  const ownerEmail = `plat-support-owner-${runId}@example.com`;
  const ownerMobile = `+9859${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const superAdminEmail = `plat-support-super-${runId}@wapp.internal`;
  const superAdminPassword = "SuperSecret1";
  const executiveEmail = `plat-support-exec-${runId}@wapp.internal`;
  const executivePassword = "ExecPassw0rd1";

  let workspaceId: string;
  let superAdminAccessToken: string;
  let executiveAccessToken: string;
  let sessionId: string;

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

    // A real tenant workspace.
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
      .send({ name: `Platform Support Test Co ${runId}` });
    const createBody = createRes.body as ApiSuccessResponse<{ workspace: { id: string } }>;
    workspaceId = createBody.data.workspace.id;
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

  describe("Break-Glass Access (§4.1)", () => {
    it("§10: rejects a duration beyond 240 minutes", async () => {
      const res = await platformAuthed(
        "post",
        "/api/v1/platform/support/access/request",
        executiveAccessToken,
      ).send({
        workspaceId,
        reason: "Investigating a customer-reported billing discrepancy",
        durationMinutes: 300,
      });
      expect(res.status).toBe(400);
    });

    it("§10/BR-001: rejects a request with no meaningful reason", async () => {
      const res = await platformAuthed(
        "post",
        "/api/v1/platform/support/access/request",
        executiveAccessToken,
      ).send({
        workspaceId,
        reason: "x",
        durationMinutes: 30,
      });
      expect(res.status).toBe(400);
    });

    it("a Support Executive can request access (REQUEST_SUPPORT_ACCESS=FULL for all roles)", async () => {
      const res = await platformAuthed(
        "post",
        "/api/v1/platform/support/access/request",
        executiveAccessToken,
      ).send({
        workspaceId,
        reason: "Investigating a customer-reported billing discrepancy",
        durationMinutes: 30,
      });
      expect(res.status).toBe(201);
      const session = (res.body as ApiSuccessResponse<SupportSessionSummary>).data;
      expect(session.status).toBe("REQUESTED");
      sessionId = session.id;
    });

    it("a Support Executive cannot approve their own request (APPROVE_SUPPORT_ACCESS=NONE)", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/support/access/${sessionId}/approve`,
        executiveAccessToken,
      );
      expect(res.status).toBe(403);
    });

    it("PLATFORM_SUPER_ADMIN approves the request", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/support/access/${sessionId}/approve`,
      );
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<SupportSessionSummary>).data.status).toBe("APPROVED");
    });
  });

  describe("Support Session lifecycle & gated cross-tenant reads (§4.2/§4.7/§11)", () => {
    it("a Support Executive cannot start a session (START_SUPPORT_SESSION=NONE)", async () => {
      const res = await platformAuthed(
        "post",
        `/api/v1/platform/support/sessions/${sessionId}/start`,
        executiveAccessToken,
      );
      expect(res.status).toBe(403);
    });

    it("blocks Workspace Overview access before the session is started", async () => {
      const res = await platformAuthed("get", `/api/v1/platform/support/workspaces/${workspaceId}`);
      expect(res.status).toBe(403);
    });

    it("PLATFORM_SUPER_ADMIN starts the session", async () => {
      const res = await platformAuthed(
        "post",
        `/api/v1/platform/support/sessions/${sessionId}/start`,
      );
      expect(res.status).toBe(201);
      const session = (res.body as ApiSuccessResponse<SupportSessionSummary>).data;
      expect(session.status).toBe("ACTIVE");
      expect(session.expiresAt).not.toBeNull();
    });

    it("grants the session holder a composed cross-tenant Workspace Overview", async () => {
      const res = await platformAuthed("get", `/api/v1/platform/support/workspaces/${workspaceId}`);
      expect(res.status).toBe(200);
      const overview = (res.body as ApiSuccessResponse<SupportWorkspaceOverview>).data;
      expect(overview.workspace.id).toBe(workspaceId);
      expect(overview.users.some((u) => u.email === ownerEmail)).toBe(true);
      expect(overview.subscription).toBeTruthy();
      expect(Array.isArray(overview.invoices)).toBe(true);
      expect(overview.settingsOverview).toBeTruthy();
    });

    it("a different platform user (Support Executive) is still denied — the session belongs to whoever started it, not the workspace generally", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/support/workspaces/${workspaceId}`,
        executiveAccessToken,
      );
      expect(res.status).toBe(403);
    });

    it("grants Investigation Timeline access to the session holder, merging Platform Audit + Settings Audit + Billing History + Login History", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/investigation?workspaceId=${workspaceId}`,
      );
      expect(res.status).toBe(200);
      const timeline = (res.body as ApiSuccessResponse<InvestigationTimelineEntry[]>).data;
      expect(timeline.some((e) => e.source === "PLATFORM_AUDIT")).toBe(true);
      expect(timeline.every((e) => e.workspaceId === workspaceId)).toBe(true);
    });

    it("ends the session", async () => {
      const res = await platformAuthed(
        "post",
        `/api/v1/platform/support/sessions/${sessionId}/end`,
      ).send({
        reason: "Investigation complete",
      });
      expect(res.status).toBe(201);
      expect((res.body as ApiSuccessResponse<SupportSessionSummary>).data.status).toBe(
        "TERMINATED",
      );
    });

    it("revokes Workspace Overview access once the session has ended", async () => {
      const res = await platformAuthed("get", `/api/v1/platform/support/workspaces/${workspaceId}`);
      expect(res.status).toBe(403);
    });

    it("lists sessions filtered by workspaceId", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/support/sessions?workspaceId=${workspaceId}`,
      );
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListSupportSessionsResult>).data;
      expect(page.items.some((s) => s.id === sessionId)).toBe(true);
    });
  });

  describe("Global Audit Center (§4.4) — closes the Volume-1 audit gap", () => {
    it("records the full Break-Glass/Support Session lifecycle", async () => {
      const res = await platformAuthed("get", `/api/v1/platform/audit?workspaceId=${workspaceId}`);
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListPlatformAuditResult>).data;
      const eventTypes = page.items.map((entry: PlatformAuditEntrySummary) => entry.eventType);
      expect(eventTypes).toEqual(
        expect.arrayContaining([
          "platform.break_glass_requested",
          "platform.break_glass_approved",
          "platform.support_session_started",
          "platform.support_session_terminated",
        ]),
      );
    });

    it("PLATFORM_FEATURE_UPDATED and PLATFORM_MAINTENANCE_ENABLED/DISABLED — previously unaudited since Volume-1 — now get durable, workspaceId=null entries", async () => {
      await platformAuthed("patch", "/api/v1/platform/feature-flags/AI_ASSISTANT").send({
        enabled: true,
      });
      await platformAuthed("patch", "/api/v1/platform/maintenance").send({ enabled: true });
      await platformAuthed("patch", "/api/v1/platform/maintenance").send({ enabled: false });

      const res = await platformAuthed("get", "/api/v1/platform/audit");
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListPlatformAuditResult>).data;
      const eventTypes = page.items.map((entry: PlatformAuditEntrySummary) => entry.eventType);
      expect(eventTypes).toEqual(
        expect.arrayContaining([
          "platform.feature_updated",
          "platform.maintenance_enabled",
          "platform.maintenance_disabled",
        ]),
      );
      const featureEntry = page.items.find(
        (entry: PlatformAuditEntrySummary) => entry.eventType === "platform.feature_updated",
      );
      expect(featureEntry?.workspaceId).toBeNull();

      // Clean up — AI_ASSISTANT's platform override is genuinely global
      // (Volume-1 §4.5, not scoped to this test's workspace), so it leaks
      // into every other e2e file sharing this Mongo instance unless reset
      // to its default (false) here — same convention platform.e2e-spec.ts
      // already established for its own CRM_MODULE override test.
      const cleanupRes = await platformAuthed(
        "patch",
        "/api/v1/platform/feature-flags/AI_ASSISTANT",
      ).send({ enabled: false });
      expect(cleanupRes.status).toBe(200);
    });

    it("Support Executive can view the Global Audit Center (VIEW_GLOBAL_AUDIT=FULL for all roles)", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/audit", executiveAccessToken);
      expect(res.status).toBe(200);
    });
  });
});
