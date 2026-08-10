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
import { PlatformUser } from "../src/modules/platform/schemas/platform-user.schema.js";
import type { PlatformUserDocument } from "../src/modules/platform/schemas/platform-user.schema.js";
import { PlatformPasswordService } from "../src/modules/platform/services/platform-password.service.js";
import type {
  GovernancePolicySummary,
  IssuedPlatformTokenPair,
  PlatformAnalyticsSnapshot,
  PlatformComplianceSnapshot,
  PlatformKpiSnapshot,
  PlatformUserProfile,
} from "../src/modules/platform/platform.types.js";
import type { ListPlatformAuditResult } from "../src/modules/platform/services/platform-audit.service.js";

jest.setTimeout(30_000);

/**
 * PRD-007 Volume-4 (Platform Analytics, Governance & Compliance) — the
 * cross-cutting layer over every prior Platform Administration volume.
 * Seeds a PLATFORM_SUPER_ADMIN and a PLATFORM_SUPPORT_EXECUTIVE directly
 * via their Mongoose models, same convention as platform-support.e2e-spec.ts.
 */
describe("Platform Analytics, Governance & Compliance (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let platformUserModel: Model<PlatformUserDocument>;
  let platformPasswordService: PlatformPasswordService;

  const runId = Date.now();
  const superAdminEmail = `plat-analytics-super-${runId}@wapp.internal`;
  const superAdminPassword = "SuperSecret1";
  const executiveEmail = `plat-analytics-exec-${runId}@wapp.internal`;
  const executivePassword = "ExecPassw0rd1";

  let superAdminAccessToken: string;
  let executiveAccessToken: string;
  let executivePlatformUserId: string;

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
    const executiveDoc = await platformUserModel.create({
      fullName: "Support Executive",
      email: executiveEmail,
      passwordHash: await platformPasswordService.hash(executivePassword),
      role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
      isActive: true,
    });
    executivePlatformUserId = executiveDoc._id.toString();

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

  describe("Platform Analytics Dashboard (§4.1)", () => {
    it("returns live cross-tenant metrics, excluding Storage/API Usage (TD-013)", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/analytics");
      expect(res.status).toBe(200);
      const snapshot = (res.body as ApiSuccessResponse<PlatformAnalyticsSnapshot>).data;
      expect(typeof snapshot.totalWorkspaces).toBe("number");
      expect(typeof snapshot.platformUsers).toBe("number");
      expect(typeof snapshot.activePlatformSessions).toBe("number");
      expect(snapshot.crmGrowth).toBeTruthy();
      expect(snapshot.revenueSummary).toBeTruthy();
      expect(snapshot).not.toHaveProperty("storageUsage");
      expect(snapshot).not.toHaveProperty("apiUsage");
    });

    it("a Support Executive can view Analytics (VIEW_PLATFORM_ANALYTICS=FULL for all roles)", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/analytics", executiveAccessToken);
      expect(res.status).toBe(200);
    });
  });

  describe("Governance Policies (§4.3/§4.6, merged) — MANAGE_PLATFORM_POLICIES Super-Admin-only", () => {
    it("rejects a policy update with no meaningful reason", async () => {
      const res = await platformAuthed("patch", "/api/v1/platform/policies/SESSION_TIMEOUT").send({
        value: { tenantAccessTtlMinutes: 30 },
        reason: "x",
      });
      expect(res.status).toBe(400);
    });

    it("rejects an unknown policy key", async () => {
      const res = await platformAuthed("patch", "/api/v1/platform/policies/NOT_A_REAL_KEY").send({
        value: { anything: true },
        reason: "Attempting an invalid policy key",
      });
      expect(res.status).toBe(400);
    });

    it("rejects Break-Glass Duration as a policy key — ADR-PLAT-005's constant stays fixed", async () => {
      const res = await platformAuthed(
        "patch",
        "/api/v1/platform/policies/BREAK_GLASS_DURATION",
      ).send({ value: { minutes: 480 }, reason: "Attempting to override the frozen ceiling" });
      expect(res.status).toBe(400);
    });

    it("a Support Executive cannot manage policies (MANAGE_PLATFORM_POLICIES=NONE for non-Super-Admin)", async () => {
      const res = await platformAuthed(
        "patch",
        "/api/v1/platform/policies/SESSION_TIMEOUT",
        executiveAccessToken,
      ).send({ value: { tenantAccessTtlMinutes: 30 }, reason: "Tightening session duration" });
      expect(res.status).toBe(403);
    });

    // GovernancePolicy is deliberately append-only with no delete route
    // (§4.6 — "Configuration is append-only with history") — unlike
    // workspace-scoped e2e fixtures that get a fresh runId-based name every
    // run, SESSION_TIMEOUT is a fixed, finite enum key shared across every
    // run of this suite against the same persistent dev Mongo instance.
    // Assertions below are relative to the version/history length observed
    // immediately before each mutation, never a hardcoded absolute value.
    let versionBeforeFirstUpdate: number;
    let versionAfterFirstUpdate: number;

    it("PLATFORM_SUPER_ADMIN updates the policy, incrementing its version by exactly 1", async () => {
      const before = await platformAuthed("get", "/api/v1/platform/policies");
      const existing = (before.body as ApiSuccessResponse<GovernancePolicySummary[]>).data.find(
        (p) => p.key === "SESSION_TIMEOUT",
      );
      versionBeforeFirstUpdate = existing?.version ?? 0;
      const historyLengthBefore = existing?.history.length ?? 0;

      const res = await platformAuthed("patch", "/api/v1/platform/policies/SESSION_TIMEOUT").send({
        value: { tenantAccessTtlMinutes: 30 },
        reason: "Tightening session duration per security review",
      });
      expect(res.status).toBe(200);
      const policy = (res.body as ApiSuccessResponse<GovernancePolicySummary>).data;
      expect(policy.version).toBe(versionBeforeFirstUpdate + 1);
      expect(policy.history).toHaveLength(historyLengthBefore + (existing ? 1 : 0));
      versionAfterFirstUpdate = policy.version;
    });

    it("updating the same key again increments the version by exactly 1 more and records history", async () => {
      const res = await platformAuthed("patch", "/api/v1/platform/policies/SESSION_TIMEOUT").send({
        value: { tenantAccessTtlMinutes: 45 },
        reason: "Further tightening after incident review",
      });
      expect(res.status).toBe(200);
      const policy = (res.body as ApiSuccessResponse<GovernancePolicySummary>).data;
      expect(policy.version).toBe(versionAfterFirstUpdate + 1);
      const lastHistoryEntry = policy.history[policy.history.length - 1];
      expect(lastHistoryEntry?.version).toBe(versionAfterFirstUpdate);
    });

    it("lists the persisted policy via GET /platform/policies", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/policies");
      expect(res.status).toBe(200);
      const policies = (res.body as ApiSuccessResponse<GovernancePolicySummary[]>).data;
      expect(policies.some((p) => p.key === "SESSION_TIMEOUT")).toBe(true);
    });

    it("every policy update generates a Platform Audit entry (BR-004)", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/audit");
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListPlatformAuditResult>).data;
      const eventTypes = page.items.map((entry) => entry.eventType);
      expect(eventTypes).toContain("platform.policy_updated");
    });
  });

  describe("Platform Permission Changes (§4.4) — role-change capability", () => {
    it("PLATFORM_SUPER_ADMIN changes a Platform User's role", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/users/${executivePlatformUserId}/role`,
      ).send({ role: PlatformRole.PLATFORM_SUPPORT_MANAGER });
      expect(res.status).toBe(200);
      const profile = (res.body as ApiSuccessResponse<PlatformUserProfile>).data;
      expect(profile.role).toBe(PlatformRole.PLATFORM_SUPPORT_MANAGER);
    });

    it("a Support role cannot change another user's role (MANAGE_PLATFORM_USERS=NONE for non-Super-Admin)", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/users/${executivePlatformUserId}/role`,
        executiveAccessToken,
      ).send({ role: PlatformRole.PLATFORM_SUPER_ADMIN });
      expect(res.status).toBe(403);
    });

    it("the role change generates a Platform Audit entry", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/audit");
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListPlatformAuditResult>).data;
      const eventTypes = page.items.map((entry) => entry.eventType);
      expect(eventTypes).toContain("platform.user_role_changed");
    });
  });

  describe("Compliance Dashboard (§4.4) — VIEW_COMPLIANCE Super-Admin-only", () => {
    it("PLATFORM_SUPER_ADMIN sees the composed Compliance snapshot", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/compliance");
      expect(res.status).toBe(200);
      const snapshot = (res.body as ApiSuccessResponse<PlatformComplianceSnapshot>).data;
      expect(snapshot.breakGlassSessions).toBeTruthy();
      expect(snapshot.platformLogins).toBeTruthy();
      expect(typeof snapshot.permissionChanges).toBe("number");
      expect(typeof snapshot.failedLoginAttempts).toBe("number");
      expect(snapshot.dataRetentionStatus).toBeTruthy();
      expect(snapshot.exportJobs).toBeTruthy();
    });

    it("reflects a fresh failed Platform login attempt in Failed Login Attempts", async () => {
      await request(server())
        .post("/api/v1/platform/auth/login")
        .send({ email: superAdminEmail, password: "WrongPassword1" });

      const res = await platformAuthed("get", "/api/v1/platform/compliance");
      const snapshot = (res.body as ApiSuccessResponse<PlatformComplianceSnapshot>).data;
      expect(snapshot.failedLoginAttempts).toBeGreaterThan(0);
    });

    it("a Support role is denied (VIEW_COMPLIANCE=NONE for non-Super-Admin)", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/compliance", executiveAccessToken);
      expect(res.status).toBe(403);
    });
  });

  describe("Platform KPIs (§4.5) — never persisted, live-calculated", () => {
    it("returns Workspace/Revenue/Customer Growth, Support Resolution Time, Availability, Feature Adoption", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/kpis");
      expect(res.status).toBe(200);
      const snapshot = (res.body as ApiSuccessResponse<PlatformKpiSnapshot>).data;
      expect(snapshot.workspaceGrowth).toBeTruthy();
      expect(snapshot.revenueGrowth).toBeTruthy();
      expect(snapshot.customerGrowth).toBeTruthy();
      expect(snapshot.platformAvailability.percentageUptime).toBeGreaterThanOrEqual(0);
      expect(snapshot.platformAvailability.percentageUptime).toBeLessThanOrEqual(100);
      expect(snapshot.platformAvailability.note).toContain("not infrastructure uptime");
      expect(Array.isArray(snapshot.featureAdoption)).toBe(true);
      expect(snapshot.featureAdoption.length).toBeGreaterThan(0);
    });
  });

  describe("Operational Reports (§4.2) — orchestration, not a new report engine", () => {
    it("returns a JSON preview for a WORKSPACE report", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/reports?type=WORKSPACE");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("rejects an export whose date range exceeds 365 days", async () => {
      const res = await platformAuthed(
        "get",
        "/api/v1/platform/reports/export?type=WORKSPACE&format=CSV&from=2020-01-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z",
      );
      expect(res.status).toBe(400);
    });

    it("exports a WORKSPACE report as CSV", async () => {
      const res = await platformAuthed(
        "get",
        "/api/v1/platform/reports/export?type=WORKSPACE&format=CSV",
      );
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
    });

    it("exports a COMPLIANCE report and emits COMPLIANCE_REPORT_EXPORTED, generating a Platform Audit entry", async () => {
      const exportRes = await platformAuthed(
        "get",
        "/api/v1/platform/reports/export?type=COMPLIANCE&format=CSV",
      );
      expect(exportRes.status).toBe(200);

      const auditRes = await platformAuthed("get", "/api/v1/platform/audit");
      const page = (auditRes.body as ApiSuccessResponse<ListPlatformAuditResult>).data;
      const eventTypes = page.items.map((entry) => entry.eventType);
      expect(eventTypes).toContain("platform.compliance_report_exported");
    });

    it("a Support role can export reports (EXPORT_PLATFORM_REPORTS=FULL for all roles)", async () => {
      const res = await platformAuthed(
        "get",
        "/api/v1/platform/reports/export?type=WORKSPACE&format=CSV",
        executiveAccessToken,
      );
      expect(res.status).toBe(200);
    });
  });
});
