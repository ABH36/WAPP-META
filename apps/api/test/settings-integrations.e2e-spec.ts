import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { ApiKeySummary } from "../src/modules/identity/identity.types.js";
import type {
  EmailIntegrationSummary,
  IntegrationHealthSummary,
  IntegrationsOverview,
  ThirdPartyAppSummary,
  WebhookSummary,
} from "../src/modules/settings/settings.types.js";

// Real registrations (real bcrypt hashing) in beforeAll — same reasoning as
// settings.e2e-spec.ts's jest.setTimeout override.
jest.setTimeout(30_000);

/**
 * Covers Phase-7 Part-3 (PRD-006 Volume-3, Integrations & External
 * Services) end-to-end against the real replica-set Mongo/Redis. WhatsApp
 * lifecycle actions are tested against the "no connection exists" 404 path
 * only — a real Meta Embedded Signup requires a completed frontend flow
 * (same caveat MetaApiClient's own doc comment already carries) and is out
 * of reach for this suite. Email Test Connection is exercised against an
 * unreachable host to verify the failure path deterministically without a
 * real SMTP server — the success path (transporter.verify() resolving) is
 * covered by email-integration.service.spec.ts with nodemailer mocked.
 */
describe("Settings — Integrations & External Services (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];

  const runId = Date.now();
  const ownerEmail = `int-owner-${runId}@example.com`;
  const ownerMobile = `+9779${String(runId).slice(-8)}`;
  const execEmail = `int-exec-${runId}@example.com`;
  const execMobile = `+9789${String(runId).slice(-8)}`;
  const password = "Passw0rd1";

  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;

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
      fullName: "Integrations Owner",
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
      .send({ name: "Integrations Test Co" });
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

  describe("GET /settings/integrations", () => {
    it("returns an empty-state overview before anything is configured", async () => {
      const res = await authed("get", "/api/v1/settings/integrations");
      expect(res.status).toBe(200);
      const overview = (res.body as ApiSuccessResponse<IntegrationsOverview>).data;

      expect(overview.whatsapp.connected).toBe(false);
      expect(overview.email.configured).toBe(false);
      expect(overview.webhookCount).toBe(0);
      expect(overview.apiKeyCount).toBe(0);
      expect(overview.thirdPartyApps).toHaveLength(4);
      expect(overview.thirdPartyApps.every((app) => !app.enabled)).toBe(true);
    });

    it("EDIT_WORKSPACE is required — Sales Executive is denied", async () => {
      const res = await authed("get", "/api/v1/settings/integrations", salesExecutiveAccessToken);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /settings/integration-health", () => {
    it("reports WHATSAPP and EMAIL as DISCONNECTED before either is configured", async () => {
      const res = await authed("get", "/api/v1/settings/integration-health");
      expect(res.status).toBe(200);
      const health = (res.body as ApiSuccessResponse<IntegrationHealthSummary>).data;

      const whatsapp = health.entries.find((entry) => entry.integration === "WHATSAPP");
      const email = health.entries.find((entry) => entry.integration === "EMAIL");
      expect(whatsapp?.status).toBe("DISCONNECTED");
      expect(email?.status).toBe("DISCONNECTED");
    });
  });

  describe("WhatsApp lifecycle actions — §4.1, no connection exists yet", () => {
    it("Test Connection 404s when no WhatsApp connection exists", async () => {
      const res = await authed("post", "/api/v1/settings/integrations/whatsapp/test-connection");
      expect(res.status).toBe(404);
    });

    it("Refresh Metadata 404s when no WhatsApp connection exists", async () => {
      const res = await authed("post", "/api/v1/settings/integrations/whatsapp/refresh-metadata");
      expect(res.status).toBe(404);
    });

    it("Disconnect requires DISCONNECT_WHATSAPP — Sales Executive is denied before even reaching the 404", async () => {
      const res = await authed(
        "post",
        "/api/v1/settings/integrations/whatsapp/disconnect",
        salesExecutiveAccessToken,
      );
      expect(res.status).toBe(403);
    });

    it("Disconnect 404s for Owner when no connection exists", async () => {
      const res = await authed("post", "/api/v1/settings/integrations/whatsapp/disconnect");
      expect(res.status).toBe(404);
    });
  });

  describe("Email Integration — §4.2", () => {
    it("rejects an invalid provider", async () => {
      const res = await authed("patch", "/api/v1/settings/integrations/email").send({
        provider: "NOT_A_PROVIDER",
        host: "smtp.example.com",
        port: 587,
        username: "notifications@example.com",
        credential: "secret",
        encryption: "TLS",
        fromAddress: "notifications@example.com",
      });
      expect(res.status).toBe(400);
    });

    it("PATCH saves the config and never returns the credential", async () => {
      const res = await authed("patch", "/api/v1/settings/integrations/email").send({
        provider: "SMTP",
        host: "smtp.example.com",
        port: 587,
        username: "notifications@example.com",
        credential: "super-secret-password",
        encryption: "TLS",
        fromAddress: "notifications@example.com",
      });
      expect(res.status).toBe(200);
      const summary = (res.body as ApiSuccessResponse<EmailIntegrationSummary>).data;
      expect(summary.configured).toBe(true);
      expect(summary.host).toBe("smtp.example.com");
      expect(JSON.stringify(summary)).not.toContain("super-secret-password");

      const overviewRes = await authed("get", "/api/v1/settings/integrations");
      const overview = (overviewRes.body as ApiSuccessResponse<IntegrationsOverview>).data;
      expect(overview.email.configured).toBe(true);
    });

    it("Test Connection performs real validation only — reports failure without throwing against an unreachable host", async () => {
      await authed("patch", "/api/v1/settings/integrations/email").send({
        provider: "SMTP",
        host: "127.0.0.1",
        port: 1,
        username: "notifications@example.com",
        credential: "super-secret-password",
        encryption: "NONE",
        fromAddress: "notifications@example.com",
      });

      const res = await authed("post", "/api/v1/settings/integrations/email/test");
      expect(res.status).toBe(201);
      const result = (res.body as ApiSuccessResponse<{ success: boolean; error: string | null }>)
        .data;
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("Webhooks — §4.3", () => {
    let webhookId: string;

    it("rejects a non-HTTPS URL (§10)", async () => {
      const res = await authed("post", "/api/v1/settings/webhooks").send({
        url: "http://example.com/hooks/wapp",
        events: ["LEAD_CREATED"],
      });
      expect(res.status).toBe(400);
    });

    it("creates a webhook and returns the secret exactly once", async () => {
      const res = await authed("post", "/api/v1/settings/webhooks").send({
        url: "https://example.com/hooks/wapp",
        events: ["LEAD_CREATED", "DEAL_WON"],
      });
      expect(res.status).toBe(201);
      const body = (res.body as ApiSuccessResponse<{ webhook: WebhookSummary; secret: string }>)
        .data;
      expect(body.secret).toMatch(/^[0-9a-f]{64}$/);
      expect(body.webhook.events).toEqual(["LEAD_CREATED", "DEAL_WON"]);
      webhookId = body.webhook.id;

      const listRes = await authed("get", "/api/v1/settings/webhooks");
      const list = (listRes.body as ApiSuccessResponse<WebhookSummary[]>).data;
      expect(list.some((webhook) => webhook.id === webhookId)).toBe(true);
      expect(JSON.stringify(list)).not.toContain(body.secret);
    });

    it("PATCH updates enabled/events without exposing the secret", async () => {
      const res = await authed("patch", `/api/v1/settings/webhooks/${webhookId}`).send({
        enabled: false,
      });
      expect(res.status).toBe(200);
      const summary = (res.body as ApiSuccessResponse<WebhookSummary>).data;
      expect(summary.enabled).toBe(false);
    });

    it("DELETE removes it; a second delete 404s", async () => {
      const first = await authed("delete", `/api/v1/settings/webhooks/${webhookId}`);
      expect(first.status).toBe(200);

      const second = await authed("delete", `/api/v1/settings/webhooks/${webhookId}`);
      expect(second.status).toBe(404);
    });
  });

  describe("API Keys — §4.4", () => {
    let apiKeyId: string;

    it("generates a key, returns the raw secret exactly once, never the hash", async () => {
      const res = await authed("post", "/api/v1/settings/api-keys").send({
        name: "CI Integration",
      });
      expect(res.status).toBe(201);
      const body = (res.body as ApiSuccessResponse<{ apiKey: ApiKeySummary; rawKey: string }>).data;
      expect(body.rawKey).toMatch(/^wapp_[0-9a-f]{64}$/);
      apiKeyId = body.apiKey.id;

      const listRes = await authed("get", "/api/v1/settings/api-keys");
      const list = (listRes.body as ApiSuccessResponse<ApiKeySummary[]>).data;
      expect(list.some((key) => key.id === apiKeyId)).toBe(true);
      expect(JSON.stringify(list)).not.toContain(body.rawKey);
    });

    it("rotate revokes the old key and issues a new one", async () => {
      const res = await authed("post", `/api/v1/settings/api-keys/${apiKeyId}/rotate`);
      expect(res.status).toBe(201);
      const body = (res.body as ApiSuccessResponse<{ apiKey: ApiKeySummary; rawKey: string }>).data;
      expect(body.apiKey.id).not.toBe(apiKeyId);

      // BR-008 — the old key cannot be revoked again (already revoked by rotate).
      const revokeOld = await authed("delete", `/api/v1/settings/api-keys/${apiKeyId}`);
      expect(revokeOld.status).toBe(404);

      apiKeyId = body.apiKey.id;
    });

    it("DELETE revokes it; a second revoke 404s (BR-008 — cannot be restored)", async () => {
      const first = await authed("delete", `/api/v1/settings/api-keys/${apiKeyId}`);
      expect(first.status).toBe(200);

      const second = await authed("delete", `/api/v1/settings/api-keys/${apiKeyId}`);
      expect(second.status).toBe(404);
    });
  });

  describe("Third-party Apps — §4.6", () => {
    it("PATCH toggles a named app on, reflected in both the app list and the overview", async () => {
      const res = await authed("patch", "/api/v1/settings/integrations/apps/ZAPIER").send({
        enabled: true,
      });
      expect(res.status).toBe(200);
      const summary = (res.body as ApiSuccessResponse<ThirdPartyAppSummary>).data;
      expect(summary).toEqual({ appKey: "ZAPIER", enabled: true });

      const listRes = await authed("get", "/api/v1/settings/integrations/apps");
      const list = (listRes.body as ApiSuccessResponse<ThirdPartyAppSummary[]>).data;
      expect(list.find((app) => app.appKey === "ZAPIER")?.enabled).toBe(true);
      expect(list.find((app) => app.appKey === "MAKE")?.enabled).toBe(false);
    });

    it("rejects an unknown app key", async () => {
      const res = await authed("patch", "/api/v1/settings/integrations/apps/NOT_AN_APP").send({
        enabled: true,
      });
      expect(res.status).toBe(400);
    });
  });
});
