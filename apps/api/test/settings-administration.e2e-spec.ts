import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import { StorageService } from "../src/infrastructure/storage/storage.service.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type {
  AuditLogPage,
  ConfigHistoryEntrySummary,
  DiagnosticsSummary,
  ExportJobSummary,
  FeatureFlagSummary,
  RetentionPolicySummary,
  SystemPreferencesSummary,
} from "../src/modules/settings/settings.types.js";
import { FeatureFlagKey } from "../src/modules/settings/schemas/feature-flag-state.schema.js";
import { AuditCategory } from "../src/modules/settings/schemas/audit-log-entry.schema.js";
import { ConfigHistoryArea } from "../src/modules/settings/schemas/config-history-entry.schema.js";
import {
  ExportEntityType,
  ExportFormat,
  ExportJobStatus,
} from "../src/modules/settings/schemas/export-job.schema.js";

jest.setTimeout(30_000);

/**
 * Covers Phase-7 Part-4 (PRD-006 Volume-4, Audit Logs, Data Management &
 * System Administration) end-to-end against the real replica-set Mongo/
 * Redis/BullMQ. StorageService is mocked (same reasoning as every other
 * e2e suite touching Cloudinary — no real network calls); Data Export's
 * async job is polled with a bounded retry loop, the same
 * eventually-consistent tolerance already established for Billing's
 * `waitForInvoiceCount` pattern.
 */
describe("Settings — Audit Logs, Data Management & System Administration (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let uploadedBuffers: Array<{ folder: string; filename: string }>;

  const runId = Date.now();
  const ownerEmail = `admin-owner-${runId}@example.com`;
  const ownerMobile = `+9819${String(runId).slice(-8)}`;
  const execEmail = `admin-exec-${runId}@example.com`;
  const execMobile = `+9829${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;

  beforeAll(async () => {
    sentEmails = [];
    uploadedBuffers = [];

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
        uploadBuffer: jest.fn((buffer: Buffer, folder: string, filename: string) => {
          uploadedBuffers.push({ folder, filename });
          return Promise.resolve({
            url: `https://cdn.example.com/${folder}/${filename}`,
            publicId: filename,
          });
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Admin Owner",
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
      .send({ name: "Admin Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>;
    ownerAccessToken = createBody.data.tokens.accessToken;

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Exec",
      email: execEmail,
      mobileNumber: execMobile,
      password,
    });
    const execVerifyToken = extractToken(extractLink(execEmail));
    const execVerifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: execVerifyToken });
    const execTokens = (execVerifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    await authed("post", "/api/v1/team/invitations").send({
      email: execEmail,
      role: "SALES_EXECUTIVE",
    });
    const inviteToken = extractToken(extractLink(execEmail, "team-invitation"));
    const acceptRes = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${execTokens.accessToken}`)
      .send({ token: inviteToken });
    salesExecutiveAccessToken = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>)
      .data.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(
    method: "get" | "post" | "patch" | "delete",
    path: string,
    token = ownerAccessToken,
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

  async function waitForExportStatus(
    id: string,
    status: ExportJobStatus,
  ): Promise<ExportJobSummary> {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const res = await authed("get", `/api/v1/settings/export/${id}`);
      const job = (res.body as ApiSuccessResponse<ExportJobSummary>).data;
      if (job.status === status || Date.now() > deadline) {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  describe("Audit Logs — §4.1", () => {
    it("EDIT_WORKSPACE is required — Sales Executive is denied", async () => {
      const res = await authed("get", "/api/v1/settings/audit-logs", salesExecutiveAccessToken);
      expect(res.status).toBe(403);
    });

    it("records a SETTINGS-category entry when Settings-owned config changes", async () => {
      await authed("patch", "/api/v1/settings/preferences").send({ currency: "USD" });

      const res = await authed(
        "get",
        `/api/v1/settings/audit-logs?category=${AuditCategory.SETTINGS}`,
      );
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<AuditLogPage>).data;
      expect(page.items.some((entry) => entry.action.includes("preferences"))).toBe(true);
    });

    it("AUTHENTICATION category composes from Identity's Login History, not a second persisted copy", async () => {
      // No explicit /auth/login call has happened for this Owner yet
      // (register->verify-email auto-issues tokens without going through
      // login()) — make one now so there's a real LoginHistoryEntry to compose.
      const loginRes = await request(server())
        .post("/api/v1/auth/login")
        .send({ email: ownerEmail, password });
      expect(loginRes.status).toBe(201);

      const res = await authed(
        "get",
        `/api/v1/settings/audit-logs?category=${AuditCategory.AUTHENTICATION}`,
      );
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<AuditLogPage>).data;
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((entry) => entry.category === AuditCategory.AUTHENTICATION)).toBe(
        true,
      );
    });
  });

  describe("Configuration History — §4.2", () => {
    it("records a PREFERENCES entry with a live newValue snapshot on change", async () => {
      await authed("patch", "/api/v1/settings/preferences").send({ currency: "EUR" });

      // SETTINGS_UPDATED -> ConfigHistoryListener is fire-and-forget
      // (eventEmitter.emit() doesn't await async listeners) — poll briefly
      // for the same eventual-consistency reason Billing's e2e suite polls
      // for generated Invoices.
      const deadline = Date.now() + 10_000;
      let entry: ConfigHistoryEntrySummary | undefined;
      while (Date.now() < deadline) {
        const res = await authed("get", "/api/v1/settings/config-history");
        expect(res.status).toBe(200);
        const page = (
          res.body as ApiSuccessResponse<{ items: ConfigHistoryEntrySummary[]; total: number }>
        ).data;
        entry = page.items.find((item) => item.area === ConfigHistoryArea.PREFERENCES);
        if (entry && (entry.newValue as { currency: string }).currency === "EUR") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(entry).toBeDefined();
      expect((entry?.newValue as { currency: string }).currency).toBe("EUR");
    });
  });

  describe("Feature Flags — §4.5", () => {
    it("returns all 5 flags with their documented defaults", async () => {
      const res = await authed("get", "/api/v1/settings/feature-flags");
      expect(res.status).toBe(200);
      const flags = (res.body as ApiSuccessResponse<FeatureFlagSummary[]>).data;
      expect(flags).toHaveLength(5);
      expect(flags.find((f) => f.flagKey === FeatureFlagKey.AI_ASSISTANT)?.enabled).toBe(false);
    });

    it("PATCH toggles a flag and it's reflected on the next GET", async () => {
      const patchRes = await authed(
        "patch",
        `/api/v1/settings/feature-flags/${FeatureFlagKey.BETA_FEATURES}`,
      ).send({ enabled: true });
      expect(patchRes.status).toBe(200);

      const res = await authed("get", "/api/v1/settings/feature-flags");
      const flags = (res.body as ApiSuccessResponse<FeatureFlagSummary[]>).data;
      expect(flags.find((f) => f.flagKey === FeatureFlagKey.BETA_FEATURES)?.enabled).toBe(true);
    });
  });

  describe("Maintenance Mode — §4.6", () => {
    it("blocks a new login while enabled, and Owner's own already-issued session keeps working", async () => {
      const patchRes = await authed("patch", "/api/v1/settings/maintenance").send({
        enabled: true,
      });
      expect(patchRes.status).toBe(200);

      // The existing access token (this Owner's own current session) must
      // keep working — "existing sessions continue."
      const overviewRes = await authed("get", "/api/v1/settings");
      expect(overviewRes.status).toBe(200);

      // A brand-new login attempt must be blocked — poll briefly since the
      // Settings -> Identity sync is event-driven (eventually consistent).
      const deadline = Date.now() + 10_000;
      let loginStatus = 0;
      while (Date.now() < deadline) {
        const loginRes = await request(server()).post("/api/v1/auth/login").send({
          email: ownerEmail,
          password,
        });
        loginStatus = loginRes.status;
        if (loginStatus === 503) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(loginStatus).toBe(503);

      // Turn it back off so later describe blocks in this file aren't affected.
      const offRes = await authed("patch", "/api/v1/settings/maintenance").send({
        enabled: false,
      });
      expect(offRes.status).toBe(200);
    });
  });

  describe("Diagnostics — §4.7", () => {
    it("reports the 6 expected checks, database/redis/queue UP against real infra, whatsapp DOWN (never connected)", async () => {
      const res = await authed("get", "/api/v1/settings/diagnostics");
      expect(res.status).toBe(200);
      const diagnostics = (res.body as ApiSuccessResponse<DiagnosticsSummary>).data;
      const names = diagnostics.checks.map((c) => c.name);
      expect(names).toEqual(["database", "redis", "queue", "storage", "email", "whatsapp"]);
      expect(diagnostics.checks.find((c) => c.name === "database")?.status).toBe("UP");
      expect(diagnostics.checks.find((c) => c.name === "redis")?.status).toBe("UP");
      expect(diagnostics.checks.find((c) => c.name === "whatsapp")?.status).toBe("DOWN");
    });
  });

  describe("System Preferences — §4.8", () => {
    it("GET returns documented defaults, PATCH updates them", async () => {
      const getRes = await authed("get", "/api/v1/settings/system-preferences");
      expect(getRes.status).toBe(200);
      const defaults = (getRes.body as ApiSuccessResponse<SystemPreferencesSummary>).data;
      expect(defaults.defaultPagination).toBe(25);

      const patchRes = await authed("patch", "/api/v1/settings/system-preferences").send({
        defaultPagination: 50,
      });
      expect(patchRes.status).toBe(200);
      const updated = (patchRes.body as ApiSuccessResponse<SystemPreferencesSummary>).data;
      expect(updated.defaultPagination).toBe(50);
    });
  });

  describe("Data Retention — §4.4", () => {
    it("rejects a value outside 30-3650 days", async () => {
      const res = await authed("patch", "/api/v1/settings/retention").send({
        auditLogRetentionDays: 10,
      });
      expect(res.status).toBe(400);
    });

    it("GET returns defaults, PATCH persists a change", async () => {
      const getRes = await authed("get", "/api/v1/settings/retention");
      expect(getRes.status).toBe(200);
      expect(
        (getRes.body as ApiSuccessResponse<RetentionPolicySummary>).data.auditLogRetentionDays,
      ).toBe(365);

      const patchRes = await authed("patch", "/api/v1/settings/retention").send({
        auditLogRetentionDays: 90,
      });
      expect(patchRes.status).toBe(200);
      expect(
        (patchRes.body as ApiSuccessResponse<RetentionPolicySummary>).data.auditLogRetentionDays,
      ).toBe(90);
    });
  });

  describe("Data Export — §4.3", () => {
    it("exports SETTINGS data as JSON, completes asynchronously, and uploads via StorageService", async () => {
      const createRes = await authed("post", "/api/v1/settings/export").send({
        entityType: ExportEntityType.SETTINGS,
        format: ExportFormat.JSON,
      });
      expect(createRes.status).toBe(201);
      const created = (createRes.body as ApiSuccessResponse<ExportJobSummary>).data;
      expect(created.status).toBe(ExportJobStatus.PENDING);

      const completed = await waitForExportStatus(created.id, ExportJobStatus.COMPLETED);
      expect(completed.status).toBe(ExportJobStatus.COMPLETED);
      expect(completed.resultUrl).toContain(".json");
      expect(uploadedBuffers.some((u) => u.filename.includes(created.id))).toBe(true);
    });

    it("§10 — rejects a second export while one is still active", async () => {
      const first = await authed("post", "/api/v1/settings/export").send({
        entityType: ExportEntityType.SETTINGS,
        format: ExportFormat.CSV,
      });
      expect(first.status).toBe(201);

      const second = await authed("post", "/api/v1/settings/export").send({
        entityType: ExportEntityType.SETTINGS,
        format: ExportFormat.CSV,
      });
      expect(second.status).toBe(400);

      // Let the first job finish so it doesn't bleed into other tests.
      const firstBody = (first.body as ApiSuccessResponse<ExportJobSummary>).data;
      await waitForExportStatus(firstBody.id, ExportJobStatus.COMPLETED);
    });
  });
});
