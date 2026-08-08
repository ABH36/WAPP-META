import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import type { Model } from "mongoose";
import request from "supertest";
import { PlatformRole, WorkspaceStatus, type ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import { StorageService } from "../src/infrastructure/storage/storage.service.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { FeatureFlagSummary } from "../src/modules/settings/settings.types.js";
import { FeatureFlagKey } from "../src/modules/settings/schemas/feature-flag-state.schema.js";
import { PlatformUser } from "../src/modules/platform/schemas/platform-user.schema.js";
import type { PlatformUserDocument } from "../src/modules/platform/schemas/platform-user.schema.js";
import { PlatformPasswordService } from "../src/modules/platform/services/platform-password.service.js";
import { AnnouncementTargetType } from "../src/modules/platform/schemas/platform-announcement.schema.js";
import type {
  AuthenticatedPlatformUser,
  IssuedPlatformTokenPair,
  PlatformUserProfile,
} from "../src/modules/platform/platform.types.js";
import type { PlatformDashboardSnapshot } from "../src/modules/platform/services/platform-dashboard.service.js";
import type { PlatformSearchResult } from "../src/modules/platform/services/platform-search.service.js";
import type { PlatformMaintenanceStatus } from "../src/modules/platform/services/platform-maintenance.service.js";
import type { PlatformFeatureFlagSummary } from "../src/modules/platform/services/platform-feature-flags.service.js";
import type { ListWorkspacesForPlatformResult } from "../src/modules/platform/services/platform-workspace-registry.service.js";

jest.setTimeout(30_000);

/**
 * PRD-007 Volume-1 (Platform Administration & Tenant Management) — the
 * first platform-scoped, cross-tenant suite. Seeds an initial
 * PLATFORM_SUPER_ADMIN directly via the Mongoose model (test-only setup,
 * same reasoning as billing.e2e-spec.ts's PlanLimits seed — Platform Users
 * are provisioned by an existing PLATFORM_SUPER_ADMIN, never
 * self-registered, so the very first one has no API path to exist). All
 * other assertions go through real HTTP against the real replica-set
 * Mongo/Redis, exercising the actual `PlatformAuthGuard`/
 * `PlatformPermissionsGuard`/event-listener wiring, not mocks.
 */
describe("Platform Administration & Tenant Management (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let platformUserModel: Model<PlatformUserDocument>;
  let platformPasswordService: PlatformPasswordService;

  const runId = Date.now();
  const ownerEmail = `plat-owner-${runId}@example.com`;
  const ownerMobile = `+9839${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const superAdminEmail = `plat-super-${runId}@wapp.internal`;
  const superAdminPassword = "SuperSecret1";

  let ownerAccessToken: string;
  let workspaceId: string;
  let superAdminAccessToken: string;

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

    // Test-only setup — the very first PLATFORM_SUPER_ADMIN has no
    // provisioning API to go through (§4.3: Platform Users are always
    // created by an existing PLATFORM_SUPER_ADMIN).
    await platformUserModel.create({
      fullName: "Founding Super Admin",
      email: superAdminEmail,
      passwordHash: await platformPasswordService.hash(superAdminPassword),
      role: PlatformRole.PLATFORM_SUPER_ADMIN,
      isActive: true,
    });

    const superLoginRes = await request(server())
      .post("/api/v1/platform/auth/login")
      .send({ email: superAdminEmail, password: superAdminPassword });
    superAdminAccessToken = (
      superLoginRes.body as ApiSuccessResponse<{ tokens: IssuedPlatformTokenPair }>
    ).data.tokens.accessToken;

    // A real tenant workspace, so Dashboard/Search/Registry have real data.
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
      .send({ name: `Platform Test Co ${runId}` });
    const createBody = createRes.body as ApiSuccessResponse<{
      tokens: IssuedTokenPair;
      workspace: { id: string };
    }>;
    ownerAccessToken = createBody.data.tokens.accessToken;
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

  function tenantAuthed(method: "get" | "post" | "patch" | "delete", path: string, token: string) {
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

  describe("Platform Auth (§6)", () => {
    it("rejects a tenant access token against a Platform route", async () => {
      const res = await tenantAuthed("get", "/api/v1/platform/dashboard", ownerAccessToken);
      expect(res.status).toBe(401);
    });

    it("rejects an unauthenticated request", async () => {
      const res = await request(server()).get("/api/v1/platform/dashboard");
      expect(res.status).toBe(401);
    });

    it("GET /platform/auth/me returns the authenticated platform identity", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/auth/me");
      expect(res.status).toBe(200);
      const body = (res.body as ApiSuccessResponse<AuthenticatedPlatformUser>).data;
      expect(body.role).toBe(PlatformRole.PLATFORM_SUPER_ADMIN);
    });
  });

  describe("Platform Users (§4.3)", () => {
    let executiveEmail: string;
    let executiveAccessToken: string;

    it("PLATFORM_SUPER_ADMIN provisions a PLATFORM_SUPPORT_EXECUTIVE", async () => {
      executiveEmail = `plat-exec-${runId}@wapp.internal`;
      const res = await platformAuthed("post", "/api/v1/platform/users").send({
        fullName: "Support Exec",
        email: executiveEmail,
        password: "ExecPassw0rd1",
        role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
      });

      expect(res.status).toBe(201);
      const created = (res.body as ApiSuccessResponse<PlatformUserProfile>).data;
      expect(created.email).toBe(executiveEmail);
      expect(created.role).toBe(PlatformRole.PLATFORM_SUPPORT_EXECUTIVE);

      const loginRes = await request(server())
        .post("/api/v1/platform/auth/login")
        .send({ email: executiveEmail, password: "ExecPassw0rd1" });
      executiveAccessToken = (
        loginRes.body as ApiSuccessResponse<{ tokens: IssuedPlatformTokenPair }>
      ).data.tokens.accessToken;
    });

    it("rejects a duplicate email", async () => {
      const res = await platformAuthed("post", "/api/v1/platform/users").send({
        fullName: "Duplicate",
        email: executiveEmail,
        password: "AnotherPassw0rd1",
        role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
      });
      expect(res.status).toBe(409);
    });

    it("MANAGE_PLATFORM_USERS is required — a Support Executive is denied", async () => {
      const res = await platformAuthed("post", "/api/v1/platform/users", executiveAccessToken).send(
        {
          fullName: "Should Fail",
          email: `should-fail-${runId}@wapp.internal`,
          password: "Passw0rd1",
          role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
        },
      );
      expect(res.status).toBe(403);
    });

    it("lists every platform user", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/users");
      expect(res.status).toBe(200);
      const list = (res.body as ApiSuccessResponse<PlatformUserProfile[]>).data;
      expect(list.some((u) => u.email === executiveEmail)).toBe(true);
    });

    it("deactivates a platform user", async () => {
      const listRes = await platformAuthed("get", "/api/v1/platform/users");
      const execUser = (listRes.body as ApiSuccessResponse<PlatformUserProfile[]>).data.find(
        (u) => u.email === executiveEmail,
      );

      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/users/${execUser?.id}/active`,
      ).send({ isActive: false });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<PlatformUserProfile>).data.isActive).toBe(false);
    });
  });

  describe("Workspace Registry (§4.1)", () => {
    it("lists workspaces, filterable by name", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/workspaces?q=${encodeURIComponent(`Platform Test Co ${runId}`)}`,
      );
      expect(res.status).toBe(200);
      const page = (res.body as ApiSuccessResponse<ListWorkspacesForPlatformResult>).data;
      expect(page.items.some((w) => w.id === workspaceId)).toBe(true);
    });

    it("§10: rejects Suspend with no reason", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/workspaces/${workspaceId}/status`,
      ).send({ status: WorkspaceStatus.SUSPENDED });
      expect(res.status).toBe(400);
    });

    it("suspends a workspace and blocks tenant login", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/workspaces/${workspaceId}/status`,
      ).send({ status: WorkspaceStatus.SUSPENDED, reason: "Chargeback investigation" });
      expect(res.status).toBe(200);

      const loginRes = await request(server())
        .post("/api/v1/auth/login")
        .send({ email: ownerEmail, password });
      expect(loginRes.status).toBe(403);
    });

    it("reactivates the workspace and restores tenant login", async () => {
      const res = await platformAuthed(
        "patch",
        `/api/v1/platform/workspaces/${workspaceId}/status`,
      ).send({ status: WorkspaceStatus.ACTIVE });
      expect(res.status).toBe(200);

      const loginRes = await request(server())
        .post("/api/v1/auth/login")
        .send({ email: ownerEmail, password });
      expect(loginRes.status).toBe(201);
    });
  });

  describe("Platform Dashboard (§4.2)", () => {
    it("aggregates cross-tenant counts and system health", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/dashboard");
      expect(res.status).toBe(200);
      const snapshot = (res.body as ApiSuccessResponse<PlatformDashboardSnapshot>).data;
      expect(snapshot.workspaces.total).toBeGreaterThanOrEqual(1);
      expect(typeof snapshot.totalUsers).toBe("number");
      expect(snapshot.systemHealth.database).toBe(true);
    });
  });

  describe("Global Announcements (§4.4)", () => {
    it("creates and lists an announcement", async () => {
      const createRes = await platformAuthed("post", "/api/v1/platform/announcements").send({
        title: "Scheduled maintenance",
        message: "The platform will be briefly unavailable this weekend.",
        targetType: AnnouncementTargetType.ALL,
      });
      expect(createRes.status).toBe(201);

      const listRes = await platformAuthed("get", "/api/v1/platform/announcements");
      expect(listRes.status).toBe(200);
      const list = (listRes.body as ApiSuccessResponse<Array<{ title: string }>>).data;
      expect(list.some((a) => a.title === "Scheduled maintenance")).toBe(true);
    });
  });

  describe("Global Feature Flags override tier (§4.5)", () => {
    it("a platform override propagates to the tenant's own feature-flags read, winning over the workspace's own toggle", async () => {
      // Baseline: CRM_MODULE defaults enabled for a fresh workspace.
      const before = await tenantAuthed("get", "/api/v1/settings/feature-flags", ownerAccessToken);
      expect(
        (before.body as ApiSuccessResponse<FeatureFlagSummary[]>).data.find(
          (f) => f.flagKey === FeatureFlagKey.CRM_MODULE,
        )?.enabled,
      ).toBe(true);

      const overrideRes = await platformAuthed(
        "patch",
        `/api/v1/platform/feature-flags/${FeatureFlagKey.CRM_MODULE}`,
      ).send({ enabled: false });
      expect(overrideRes.status).toBe(200);

      // Event-driven propagation into Settings' local read model — poll briefly.
      const deadline = Date.now() + 5000;
      let crmEnabled = true;
      while (Date.now() < deadline) {
        const after = await tenantAuthed("get", "/api/v1/settings/feature-flags", ownerAccessToken);
        crmEnabled = (after.body as ApiSuccessResponse<FeatureFlagSummary[]>).data.find(
          (f) => f.flagKey === FeatureFlagKey.CRM_MODULE,
        )!.enabled;
        if (!crmEnabled) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(crmEnabled).toBe(false);

      // Clean up — clear the override so later suites aren't affected.
      const clearRes = await platformAuthed(
        "patch",
        `/api/v1/platform/feature-flags/${FeatureFlagKey.CRM_MODULE}`,
      ).send({ enabled: true });
      expect(clearRes.status).toBe(200);
    });

    it("GET /platform/feature-flags lists all 5 keys", async () => {
      const res = await platformAuthed("get", "/api/v1/platform/feature-flags");
      expect(res.status).toBe(200);
      const list = (res.body as ApiSuccessResponse<PlatformFeatureFlagSummary[]>).data;
      expect(list).toHaveLength(5);
    });
  });

  describe("Platform Maintenance (§4.7)", () => {
    it("blocks tenant login platform-wide while enabled, restores it once disabled", async () => {
      const enableRes = await platformAuthed("patch", "/api/v1/platform/maintenance").send({
        enabled: true,
        reason: "Planned upgrade window",
      });
      expect(enableRes.status).toBe(200);
      expect((enableRes.body as ApiSuccessResponse<PlatformMaintenanceStatus>).data.enabled).toBe(
        true,
      );

      const blockedLoginRes = await request(server())
        .post("/api/v1/auth/login")
        .send({ email: ownerEmail, password });
      expect(blockedLoginRes.status).toBe(503);

      const disableRes = await platformAuthed("patch", "/api/v1/platform/maintenance").send({
        enabled: false,
      });
      expect(disableRes.status).toBe(200);

      const restoredLoginRes = await request(server())
        .post("/api/v1/auth/login")
        .send({ email: ownerEmail, password });
      expect(restoredLoginRes.status).toBe(201);
    });
  });

  describe("Workspace Search (§4.6)", () => {
    it("finds both the seeded workspace and its owner user", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/search?q=${encodeURIComponent(`Platform Test Co ${runId}`)}`,
      );
      expect(res.status).toBe(200);
      const result = (res.body as ApiSuccessResponse<PlatformSearchResult>).data;
      expect(result.workspaces.some((w) => w.id === workspaceId)).toBe(true);
    });

    it("finds a user by email", async () => {
      const res = await platformAuthed(
        "get",
        `/api/v1/platform/search?q=${encodeURIComponent(ownerEmail)}`,
      );
      expect(res.status).toBe(200);
      const result = (res.body as ApiSuccessResponse<PlatformSearchResult>).data;
      expect(result.users.some((u) => u.email === ownerEmail)).toBe(true);
    });
  });
});
