import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import cookieParser from "cookie-parser";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { AccessTokenIssued } from "../src/modules/identity/identity.types.js";
import type {
  InvitationSummary,
  MemberSummary,
  WorkspaceProfile,
} from "../src/modules/workspace/workspace.types.js";

/**
 * Full Workspace & Tenant Management flow against live Docker Mongo/Redis,
 * building directly on top of a real Identity registration/verification/
 * login flow (this is the actual approved onboarding order — Register ->
 * Verify -> Create Workspace -> Invite Team -> ...). Same EmailService
 * override pattern as auth.e2e-spec.ts.
 *
 * PHD-001 Volume-1 — the refresh token now travels as an httpOnly Set-Cookie
 * header, never in the JSON response body. Owner and member each get their
 * own supertest agent (a real cookie jar), exactly like two separate
 * browsers, instead of manually threading a refreshToken string around.
 */
describe("Workspace & Team (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let ownerAgent: ReturnType<typeof request.agent>;
  let memberAgent: ReturnType<typeof request.agent>;

  const runId = Date.now();
  const ownerEmail = `owner-${runId}@example.com`;
  const ownerMobile = `+9166${String(runId).slice(-8)}`;
  const memberEmail = `member-${runId}@example.com`;
  const memberMobile = `+9155${String(runId).slice(-8)}`;
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

    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    ownerAgent = request.agent(server());
    memberAgent = request.agent(server());
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function extractToken(link: string): string {
    return new URL(link).searchParams.get("token") ?? "";
  }

  function extractLink(to: string, category: string): string {
    const job = sentEmails.find((email) => email.to === to && email.category === category);
    const link = job?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) {
      throw new Error(`No ${category} email found for ${to}`);
    }
    return link;
  }

  async function registerAndVerify(
    agent: ReturnType<typeof request.agent>,
    email: string,
    mobileNumber: string,
    fullName: string,
  ): Promise<string> {
    await agent.post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const token = extractToken(extractLink(email, "email-verification"));
    const response = await agent.post("/api/v1/auth/verify-email").send({ token });
    const body = response.body as ApiSuccessResponse<{ tokens: AccessTokenIssued }>;
    return body.data.tokens.accessToken;
  }

  let ownerAccessToken: string;
  let memberAccessToken: string;
  let workspaceId: string;

  it("registers and verifies the future workspace Owner", async () => {
    ownerAccessToken = await registerAndVerify(ownerAgent, ownerEmail, ownerMobile, "Owner User");
    expect(ownerAccessToken).toBeDefined();
  });

  it("creates a workspace and returns tokens reflecting OWNER/ACTIVE", async () => {
    const response = await ownerAgent
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Acme Trading Co" });

    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: AccessTokenIssued;
    }>;
    expect(body.data.workspace.name).toBe("Acme Trading Co");
    expect(body.data.workspace.status).toBe("TRIAL");
    workspaceId = body.data.workspace.id;
    ownerAccessToken = body.data.tokens.accessToken;
  });

  it("rejects creating a second workspace for the same user", async () => {
    const response = await ownerAgent
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Second Workspace" });
    expect(response.status).toBe(409);
  });

  it("returns the current workspace", async () => {
    const response = await ownerAgent
      .get("/api/v1/workspaces/me")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.id).toBe(workspaceId);
  });

  it("updates the business profile including GSTIN", async () => {
    const response = await ownerAgent
      .patch("/api/v1/workspaces/me/business-profile")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ category: "Manufacturing", description: "B2B trading", gstin: "27ABCDE1234F1Z5" });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.businessProfile.gstin).toBe("27ABCDE1234F1Z5");
  });

  it("rejects a malformed GSTIN", async () => {
    const response = await ownerAgent
      .patch("/api/v1/workspaces/me/business-profile")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ gstin: "not-a-gstin" });
    expect(response.status).toBe(400);
  });

  it("updates business hours", async () => {
    const response = await ownerAgent
      .patch("/api/v1/workspaces/me/business-hours")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        timezone: "Asia/Kolkata",
        schedule: [{ dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" }],
        publicHolidays: [{ date: "2026-01-26", name: "Republic Day" }],
      });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.businessHours.publicHolidays).toHaveLength(1);
  });

  it("rejects a business-hours schedule with duplicate days", async () => {
    const response = await ownerAgent
      .patch("/api/v1/workspaces/me/business-hours")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        schedule: [
          { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
          { dayOfWeek: 2, isOpen: true, openTime: "10:00", closeTime: "19:00" },
        ],
      });
    expect(response.status).toBe(400);
  });

  it("updates notification settings", async () => {
    const response = await ownerAgent
      .patch("/api/v1/workspaces/me/notification-settings")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ broadcastCompleted: false });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.notificationSettings.broadcastCompleted).toBe(false);
  });

  it("registers and verifies the future team member", async () => {
    memberAccessToken = await registerAndVerify(
      memberAgent,
      memberEmail,
      memberMobile,
      "Member User",
    );
    expect(memberAccessToken).toBeDefined();
  });

  it("invites the team member", async () => {
    const response = await ownerAgent
      .post("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ email: memberEmail, role: "SALES_EXECUTIVE" });
    expect(response.status).toBe(201);
  });

  it("lists the pending invitation", async () => {
    const response = await ownerAgent
      .get("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<InvitationSummary[]>;
    expect(body.data.some((invitation) => invitation.email === memberEmail)).toBe(true);
  });

  it("rejects accepting an invalid invitation token", async () => {
    const response = await memberAgent
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberAccessToken}`)
      .send({ token: "not-a-real-token" });
    expect(response.status).toBe(400);
  });

  it("accepts the invitation and joins the workspace with the invited role", async () => {
    const token = extractToken(extractLink(memberEmail, "team-invitation"));
    const response = await memberAgent
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberAccessToken}`)
      .send({ token });

    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: AccessTokenIssued;
    }>;
    expect(body.data.workspace.id).toBe(workspaceId);
    memberAccessToken = body.data.tokens.accessToken;
  });

  it("lists both members", async () => {
    const response = await ownerAgent
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<MemberSummary[]>;
    expect(body.data.map((member) => member.email).sort()).toEqual(
      [ownerEmail, memberEmail].sort(),
    );
  });

  it("changes the member's role", async () => {
    const membersResponse = await ownerAgent
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    const members = (membersResponse.body as ApiSuccessResponse<MemberSummary[]>).data;
    const memberId = members.find((member) => member.email === memberEmail)?.id ?? "";

    const response = await ownerAgent
      .patch(`/api/v1/team/members/${memberId}/role`)
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ role: "SUPPORT_MANAGER" });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<MemberSummary>;
    expect(body.data.role).toBe("SUPPORT_MANAGER");
  });

  it("enforces RBAC — the member's refreshed token reflects the new role and lacks INVITE_USER", async () => {
    // memberAgent already carries the httpOnly refresh cookie set by
    // registerAndVerify/accept-invitation above — no body needed.
    const refreshResponse = await memberAgent.post("/api/v1/auth/refresh");
    const refreshed = (refreshResponse.body as ApiSuccessResponse<AccessTokenIssued>).data;

    const response = await memberAgent
      .post("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${refreshed.accessToken}`)
      .send({ email: "someone-else@example.com", role: "SALES_EXECUTIVE" });
    expect(response.status).toBe(403);

    memberAccessToken = refreshed.accessToken;
  });

  let memberId: string;

  it("suspends the member and blocks their login", async () => {
    const membersResponse = await ownerAgent
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    const members = (membersResponse.body as ApiSuccessResponse<MemberSummary[]>).data;
    memberId = members.find((member) => member.email === memberEmail)?.id ?? "";

    const suspendResponse = await ownerAgent
      .post(`/api/v1/team/members/${memberId}/suspend`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(suspendResponse.status).toBe(200);

    const loginResponse = await memberAgent
      .post("/api/v1/auth/login")
      .send({ email: memberEmail, password });
    expect(loginResponse.status).toBe(403);
  });

  it("reactivates the member and restores login", async () => {
    const response = await ownerAgent
      .post(`/api/v1/team/members/${memberId}/reactivate`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(response.status).toBe(200);

    const loginResponse = await memberAgent
      .post("/api/v1/auth/login")
      .send({ email: memberEmail, password });
    expect(loginResponse.status).toBe(201);
    const body = loginResponse.body as ApiSuccessResponse<{ tokens: AccessTokenIssued }>;
    memberAccessToken = body.data.tokens.accessToken;
  });

  it("transfers ownership to the member and demotes the original Owner to Administrator", async () => {
    const response = await ownerAgent
      .post(`/api/v1/team/ownership-transfer/${memberId}`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<AccessTokenIssued>;
    ownerAccessToken = body.data.accessToken; // now the (demoted) Administrator's fresh token

    const membersResponse = await ownerAgent
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    const members = (membersResponse.body as ApiSuccessResponse<MemberSummary[]>).data;
    expect(members.find((member) => member.email === memberEmail)?.role).toBe("OWNER");
    expect(members.find((member) => member.email === ownerEmail)?.role).toBe("ADMINISTRATOR");
  });

  it("rejects a second ownership transfer attempt by the now-Administrator", async () => {
    const response = await ownerAgent
      .post(`/api/v1/team/ownership-transfer/${memberId}`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(response.status).toBe(403);
  });
});
