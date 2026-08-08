import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type {
  IssuedTokenPair,
  LoginHistorySummary,
  SessionSummary,
} from "../src/modules/identity/identity.types.js";
import { StorageService } from "../src/infrastructure/storage/storage.service.js";
import type {
  LogoUploadSignature,
  SettingsOverview,
  UserSettingsOverview,
} from "../src/modules/settings/settings.types.js";

// This file now covers both Volume-1 and Volume-2, each with multiple real
// registrations (real bcrypt hashing) per beforeAll — comfortably over the
// default 5s hook timeout under normal system load.
jest.setTimeout(30_000);

/**
 * Covers Phase-7 Part-1 (PRD-006 Volume-1, Workspace Settings) end-to-end
 * against the real replica-set Mongo: the unified read overview
 * (orchestrating Workspace's own Business Profile/Business Hours/
 * Notification Settings/Language alongside Settings-owned branding/
 * preferences), preferences updates, the logo upload-signature + reference
 * flow (StorageService mocked — same reasoning EmailService is mocked in
 * every e2e suite: no real external network calls), and the EDIT_WORKSPACE
 * permission (resolved 2026-08-07, Architecture Review — reused for every
 * Settings route, including reads).
 */
describe("Settings — Workspace Settings (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let deleteAssetCalls: string[];

  const runId = Date.now();
  const ownerEmail = `settings-owner-${runId}@example.com`;
  const ownerMobile = `+9679${String(runId).slice(-8)}`;
  const execEmail = `settings-exec-${runId}@example.com`;
  const execMobile = `+9689${String(runId).slice(-8)}`;
  const adminEmail = `settings-admin-${runId}@example.com`;
  const adminMobile = `+9699${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;
  let administratorAccessToken: string;

  beforeAll(async () => {
    sentEmails = [];
    deleteAssetCalls = [];

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
        generateUploadSignature: jest.fn((folder: string) => ({
          signature: "test-signature",
          timestamp: Math.round(Date.now() / 1000),
          apiKey: "test-api-key",
          cloudName: "test-cloud",
          folder,
        })),
        deleteAsset: jest.fn((publicId: string) => {
          deleteAssetCalls.push(publicId);
          return Promise.resolve();
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Settings Owner",
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
      .send({ name: "Settings Test Co" });
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

  it("GET /settings orchestrates Workspace's own fields alongside India-market default preferences", async () => {
    const res = await authed("get", "/api/v1/settings");
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<SettingsOverview>).data;

    expect(overview.language).toBe("en");
    expect(overview.businessHours.timezone).toBe("Asia/Kolkata");
    expect(overview.branding.logoUrl).toBeNull();
    expect(overview.preferences).toEqual({
      currency: "INR",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
    });
  });

  it("reflects a change made through Workspace's own existing endpoint — orchestration, not a stale duplicate", async () => {
    await authed("patch", "/api/v1/workspaces/me/business-profile").send({
      category: "E-commerce",
      description: "Updated via Workspace's own endpoint",
    });

    const res = await authed("get", "/api/v1/settings");
    const overview = (res.body as ApiSuccessResponse<SettingsOverview>).data;
    expect(overview.businessProfile.category).toBe("E-commerce");
    expect(overview.businessProfile.description).toBe("Updated via Workspace's own endpoint");
  });

  it("PATCH /settings/preferences updates only Settings-owned fields", async () => {
    const res = await authed("patch", "/api/v1/settings/preferences").send({
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "12h",
    });
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<SettingsOverview>).data;
    expect(overview.preferences).toEqual({
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "12h",
    });
  });

  it("rejects an unrecognized date format", async () => {
    const res = await authed("patch", "/api/v1/settings/preferences").send({
      dateFormat: "not-a-real-format",
    });
    expect(res.status).toBe(400);
  });

  it("POST /settings/branding/logo/upload-signature reuses StorageService with a workspace-scoped folder", async () => {
    const res = await authed("post", "/api/v1/settings/branding/logo/upload-signature");
    expect(res.status).toBe(201);
    const signature = (res.body as ApiSuccessResponse<LogoUploadSignature>).data;
    expect(signature.signature).toBe("test-signature");
    expect(signature.folder).toMatch(/^workspaces\/.+\/logos$/);
  });

  it("PATCH /settings/branding/logo persists the reference without deleting anything the first time", async () => {
    const res = await authed("patch", "/api/v1/settings/branding/logo").send({
      logoUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/logo-1.png",
      logoPublicId: "logo-1",
    });
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<SettingsOverview>).data;
    expect(overview.branding.logoUrl).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/v1/logo-1.png",
    );
    expect(deleteAssetCalls).not.toContain("logo-1");
  });

  it("replacing the logo deletes the previous Cloudinary asset before persisting the new reference", async () => {
    const res = await authed("patch", "/api/v1/settings/branding/logo").send({
      logoUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/logo-2.png",
      logoPublicId: "logo-2",
    });
    expect(res.status).toBe(200);
    expect(deleteAssetCalls).toContain("logo-1");

    const overview = (res.body as ApiSuccessResponse<SettingsOverview>).data;
    expect(overview.branding.logoUrl).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/v1/logo-2.png",
    );
  });

  it("DELETE /settings/branding/logo deletes the Cloudinary asset and clears the reference", async () => {
    const res = await authed("delete", "/api/v1/settings/branding/logo");
    expect(res.status).toBe(200);
    expect(deleteAssetCalls).toContain("logo-2");

    const overview = (res.body as ApiSuccessResponse<SettingsOverview>).data;
    expect(overview.branding.logoUrl).toBeNull();
  });

  it("Sales Executive (no EDIT_WORKSPACE) is forbidden from every Settings endpoint; Administrator (EDIT_WORKSPACE=FULL) can access all", async () => {
    const execGetRes = await authed("get", "/api/v1/settings", salesExecutiveAccessToken);
    expect(execGetRes.status).toBe(403);

    const execPatchRes = await authed(
      "patch",
      "/api/v1/settings/preferences",
      salesExecutiveAccessToken,
    ).send({ currency: "EUR" });
    expect(execPatchRes.status).toBe(403);

    const adminGetRes = await authed("get", "/api/v1/settings", administratorAccessToken);
    expect(adminGetRes.status).toBe(200);

    const adminPatchRes = await authed(
      "patch",
      "/api/v1/settings/preferences",
      administratorAccessToken,
    ).send({ currency: "EUR" });
    expect(adminPatchRes.status).toBe(200);
  });
});

/**
 * Covers Phase-7 Part-2 (PRD-006 Volume-2, User Preferences & Security
 * Settings) end-to-end against the real replica-set Mongo: personal
 * preferences (isolated per user, BR-001), the User Override -> Workspace
 * Default effective-format resolution (ADR-SET-003), and Identity
 * orchestration for Password/Sessions/Login History (ADR-SET-004) —
 * including the real password-history rejection and the real refresh-token
 * revocation a password change triggers. Self-scoped routes require no
 * particular role (resolved 2026-08-07, Architecture Review — authentication
 * only), verified with an invited member holding no elevated permission.
 */
describe("Settings — User Preferences & Security (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];

  const runId = Date.now();
  const ownerEmail = `settings-user-owner-${runId}@example.com`;
  const ownerMobile = `+9609${String(runId).slice(-8)}`;
  const memberEmail = `settings-user-member-${runId}@example.com`;
  const memberMobile = `+9619${String(runId).slice(-8)}`;
  const ownerPassword = "Passw0rd1";

  let ownerAccessToken: string;
  let ownerRefreshToken: string;
  let memberAccessToken: string;

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

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Settings User Owner",
      email: ownerEmail,
      mobileNumber: ownerMobile,
      password: ownerPassword,
    });
    const verifyToken = extractToken(extractLink(ownerEmail));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const tokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data.tokens;

    const createRes = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ name: "Settings User Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>;
    ownerAccessToken = createBody.data.tokens.accessToken;
    ownerRefreshToken = createBody.data.tokens.refreshToken;

    memberAccessToken = await inviteAndAccept(
      memberEmail,
      memberMobile,
      "Member",
      "SALES_EXECUTIVE",
    );
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
      password: ownerPassword,
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

  it("GET /settings/user defaults to inheriting the Workspace's Date/Time Format (Volume-1)", async () => {
    const res = await authed("get", "/api/v1/settings/user");
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<UserSettingsOverview>).data;

    expect(overview.dateFormat).toEqual({ value: "DD/MM/YYYY", source: "WORKSPACE" });
    expect(overview.timeFormat).toEqual({ value: "24h", source: "WORKSPACE" });
    expect(overview.timezone).toBe("Asia/Kolkata");
    expect(overview.theme).toBe("SYSTEM");
  });

  it("a personal Date Format override takes precedence, and can be cleared back to the Workspace default", async () => {
    const overrideRes = await authed("patch", "/api/v1/settings/user/preferences").send({
      dateFormat: "YYYY-MM-DD",
    });
    expect(overrideRes.status).toBe(200);
    expect((overrideRes.body as ApiSuccessResponse<UserSettingsOverview>).data.dateFormat).toEqual({
      value: "YYYY-MM-DD",
      source: "USER",
    });

    const clearRes = await authed("patch", "/api/v1/settings/user/preferences").send({
      dateFormat: null,
    });
    expect(clearRes.status).toBe(200);
    expect((clearRes.body as ApiSuccessResponse<UserSettingsOverview>).data.dateFormat).toEqual({
      value: "DD/MM/YYYY",
      source: "WORKSPACE",
    });
  });

  it("PATCH /settings/user/theme updates appearance", async () => {
    const res = await authed("patch", "/api/v1/settings/user/theme").send({
      theme: "DARK",
      sidebar: "COLLAPSED",
      density: "COMPACT",
    });
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<UserSettingsOverview>).data;
    expect(overview.theme).toBe("DARK");
    expect(overview.sidebar).toBe("COLLAPSED");
    expect(overview.density).toBe("COMPACT");
  });

  it("PATCH /settings/user/dashboard updates landing page and pinned pages", async () => {
    const res = await authed("patch", "/api/v1/settings/user/dashboard").send({
      defaultLandingPage: "CRM",
      pinnedPages: ["customers", "deals"],
    });
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<UserSettingsOverview>).data;
    expect(overview.defaultLandingPage).toBe("CRM");
    expect(overview.pinnedPages).toEqual(["customers", "deals"]);
  });

  it("PATCH /settings/user/notifications updates only the specified event/channel", async () => {
    const res = await authed("patch", "/api/v1/settings/user/notifications").send({
      notifications: { mention: { inApp: false } },
    });
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<UserSettingsOverview>).data;
    expect(overview.notifications.mention).toEqual({ inApp: false, email: true });
    expect(overview.notifications.dealWon).toEqual({ inApp: true, email: true });
  });

  it("preferences are personal — the invited member's own settings are unaffected by the Owner's changes (BR-001)", async () => {
    const res = await authed("get", "/api/v1/settings/user", memberAccessToken);
    expect(res.status).toBe(200);
    const overview = (res.body as ApiSuccessResponse<UserSettingsOverview>).data;
    expect(overview.theme).toBe("SYSTEM");
    expect(overview.dateFormat).toEqual({ value: "DD/MM/YYYY", source: "WORKSPACE" });
  });

  it("no permission beyond authentication is required — a Sales Executive can manage their own preferences", async () => {
    const res = await authed("patch", "/api/v1/settings/user/theme", memberAccessToken).send({
      theme: "LIGHT",
    });
    expect(res.status).toBe(200);
  });

  it("GET /settings/security/sessions lists the active session, DELETE removes a specific one", async () => {
    const listRes = await authed("get", "/api/v1/settings/security/sessions");
    expect(listRes.status).toBe(200);
    const sessions = (listRes.body as ApiSuccessResponse<SessionSummary[]>).data;
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const deleteRes = await authed(
      "delete",
      `/api/v1/settings/security/sessions/${sessions[0]!.id}`,
    );
    expect(deleteRes.status).toBe(200);
  });

  it("rejects a password change with the wrong current password", async () => {
    const res = await authed("post", "/api/v1/settings/security/change-password").send({
      currentPassword: "WrongPassword1",
      newPassword: "NewPassw0rd1",
    });
    expect(res.status).toBe(400);
  });

  it("changes the password, revokes the old refresh token, and rejects reuse of the previous password", async () => {
    const changeRes = await authed("post", "/api/v1/settings/security/change-password").send({
      currentPassword: ownerPassword,
      newPassword: "NewPassw0rd1",
    });
    expect(changeRes.status).toBe(200);

    // The pre-change refresh token must now be revoked.
    const refreshRes = await request(server())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: ownerRefreshToken });
    expect(refreshRes.status).toBe(401);

    // Re-login with the new password to keep the suite going.
    const loginRes = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: ownerEmail, password: "NewPassw0rd1" });
    expect(loginRes.status).toBe(201);
    const loginBody = (loginRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;
    ownerAccessToken = loginBody.tokens.accessToken;

    // Changing back to the original password must be rejected (password history).
    const reuseRes = await authed("post", "/api/v1/settings/security/change-password").send({
      currentPassword: "NewPassw0rd1",
      newPassword: ownerPassword,
    });
    expect(reuseRes.status).toBe(400);
  });

  it("GET /settings/security/login-history reflects a failed login attempt", async () => {
    const failedLoginRes = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: ownerEmail, password: "DefinitelyWrongPassword1" });
    expect(failedLoginRes.status).toBe(401);

    const res = await authed("get", "/api/v1/settings/security/login-history");
    expect(res.status).toBe(200);
    const history = (res.body as ApiSuccessResponse<LoginHistorySummary[]>).data;
    expect(history.some((entry) => !entry.success && entry.reason === "INVALID_CREDENTIALS")).toBe(
      true,
    );
    expect(history.some((entry) => entry.success)).toBe(true);
  });

  it("DELETE /settings/security/sessions revokes every session for the user", async () => {
    const res = await authed("delete", "/api/v1/settings/security/sessions");
    expect(res.status).toBe(200);

    const sessionsRes = await authed("get", "/api/v1/settings/security/sessions");
    // The request's own access token is still valid (stateless JWT), but the
    // underlying session collection should now show no active sessions left.
    expect(sessionsRes.status).toBe(200);
    const sessions = (sessionsRes.body as ApiSuccessResponse<SessionSummary[]>).data;
    expect(sessions).toEqual([]);
  });
});
