import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
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
 */
describe("Workspace & Team (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];

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

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();
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
    email: string,
    mobileNumber: string,
    fullName: string,
  ): Promise<IssuedTokenPair> {
    await request(server()).post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const token = extractToken(extractLink(email, "email-verification"));
    const response = await request(server()).post("/api/v1/auth/verify-email").send({ token });
    const body = response.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>;
    return body.data.tokens;
  }

  let ownerTokens: IssuedTokenPair;
  let workspaceId: string;

  it("registers and verifies the future workspace Owner", async () => {
    ownerTokens = await registerAndVerify(ownerEmail, ownerMobile, "Owner User");
    expect(ownerTokens.accessToken).toBeDefined();
  });

  it("creates a workspace and returns tokens reflecting OWNER/ACTIVE", async () => {
    const response = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ name: "Acme Trading Co" });

    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    expect(body.data.workspace.name).toBe("Acme Trading Co");
    expect(body.data.workspace.status).toBe("TRIAL");
    workspaceId = body.data.workspace.id;
    ownerTokens = body.data.tokens;
  });

  it("rejects creating a second workspace for the same user", async () => {
    const response = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ name: "Second Workspace" });
    expect(response.status).toBe(409);
  });

  it("returns the current workspace", async () => {
    const response = await request(server())
      .get("/api/v1/workspaces/me")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.id).toBe(workspaceId);
  });

  it("updates the business profile including GSTIN", async () => {
    const response = await request(server())
      .patch("/api/v1/workspaces/me/business-profile")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ category: "Manufacturing", description: "B2B trading", gstin: "27ABCDE1234F1Z5" });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.businessProfile.gstin).toBe("27ABCDE1234F1Z5");
  });

  it("rejects a malformed GSTIN", async () => {
    const response = await request(server())
      .patch("/api/v1/workspaces/me/business-profile")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ gstin: "not-a-gstin" });
    expect(response.status).toBe(400);
  });

  it("updates business hours", async () => {
    const response = await request(server())
      .patch("/api/v1/workspaces/me/business-hours")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
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
    const response = await request(server())
      .patch("/api/v1/workspaces/me/business-hours")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({
        schedule: [
          { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
          { dayOfWeek: 2, isOpen: true, openTime: "10:00", closeTime: "19:00" },
        ],
      });
    expect(response.status).toBe(400);
  });

  it("updates notification settings", async () => {
    const response = await request(server())
      .patch("/api/v1/workspaces/me/notification-settings")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ broadcastCompleted: false });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<WorkspaceProfile>;
    expect(body.data.notificationSettings.broadcastCompleted).toBe(false);
  });

  let memberTokens: IssuedTokenPair;

  it("registers and verifies the future team member", async () => {
    memberTokens = await registerAndVerify(memberEmail, memberMobile, "Member User");
    expect(memberTokens.accessToken).toBeDefined();
  });

  it("invites the team member", async () => {
    const response = await request(server())
      .post("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ email: memberEmail, role: "SALES_EXECUTIVE" });
    expect(response.status).toBe(201);
  });

  it("lists the pending invitation", async () => {
    const response = await request(server())
      .get("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<InvitationSummary[]>;
    expect(body.data.some((invitation) => invitation.email === memberEmail)).toBe(true);
  });

  it("rejects accepting an invalid invitation token", async () => {
    const response = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: "not-a-real-token" });
    expect(response.status).toBe(400);
  });

  it("accepts the invitation and joins the workspace with the invited role", async () => {
    const token = extractToken(extractLink(memberEmail, "team-invitation"));
    const response = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token });

    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    expect(body.data.workspace.id).toBe(workspaceId);
    memberTokens = body.data.tokens;
  });

  it("lists both members", async () => {
    const response = await request(server())
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<MemberSummary[]>;
    expect(body.data.map((member) => member.email).sort()).toEqual(
      [ownerEmail, memberEmail].sort(),
    );
  });

  it("changes the member's role", async () => {
    const membersResponse = await request(server())
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    const members = (membersResponse.body as ApiSuccessResponse<MemberSummary[]>).data;
    const memberId = members.find((member) => member.email === memberEmail)?.id ?? "";

    const response = await request(server())
      .patch(`/api/v1/team/members/${memberId}/role`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ role: "SUPPORT_MANAGER" });
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<MemberSummary>;
    expect(body.data.role).toBe("SUPPORT_MANAGER");
  });

  it("enforces RBAC — the member's refreshed token reflects the new role and lacks INVITE_USER", async () => {
    const refreshResponse = await request(server())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: memberTokens.refreshToken });
    const refreshed = (refreshResponse.body as ApiSuccessResponse<IssuedTokenPair>).data;

    const response = await request(server())
      .post("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${refreshed.accessToken}`)
      .send({ email: "someone-else@example.com", role: "SALES_EXECUTIVE" });
    expect(response.status).toBe(403);

    memberTokens = refreshed;
  });

  let memberId: string;

  it("suspends the member and blocks their login", async () => {
    const membersResponse = await request(server())
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    const members = (membersResponse.body as ApiSuccessResponse<MemberSummary[]>).data;
    memberId = members.find((member) => member.email === memberEmail)?.id ?? "";

    const suspendResponse = await request(server())
      .post(`/api/v1/team/members/${memberId}/suspend`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(suspendResponse.status).toBe(200);

    const loginResponse = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: memberEmail, password });
    expect(loginResponse.status).toBe(403);
  });

  it("reactivates the member and restores login", async () => {
    const response = await request(server())
      .post(`/api/v1/team/members/${memberId}/reactivate`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(response.status).toBe(200);

    const loginResponse = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: memberEmail, password });
    expect(loginResponse.status).toBe(201);
    const body = loginResponse.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>;
    memberTokens = body.data.tokens;
  });

  it("transfers ownership to the member and demotes the original Owner to Administrator", async () => {
    const response = await request(server())
      .post(`/api/v1/team/ownership-transfer/${memberId}`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<IssuedTokenPair>;
    ownerTokens = body.data; // now the (demoted) Administrator's fresh tokens

    const membersResponse = await request(server())
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    const members = (membersResponse.body as ApiSuccessResponse<MemberSummary[]>).data;
    expect(members.find((member) => member.email === memberEmail)?.role).toBe("OWNER");
    expect(members.find((member) => member.email === ownerEmail)?.role).toBe("ADMINISTRATOR");
  });

  it("rejects a second ownership transfer attempt by the now-Administrator", async () => {
    const response = await request(server())
      .post(`/api/v1/team/ownership-transfer/${memberId}`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(response.status).toBe(403);
  });
});
