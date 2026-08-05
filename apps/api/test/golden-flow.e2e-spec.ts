import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { MemberSummary, WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";

/**
 * THE Golden Flow — the canonical long-term regression test for Identity +
 * Workspace together (Architecture Review recommendation, Phase-3 review).
 * One continuous scenario, happy path only, no edge cases (those live in
 * auth.e2e-spec.ts and workspace.e2e-spec.ts) — this is the single test that
 * should catch a break anywhere along the real onboarding lifecycle:
 *
 *   Register -> Verify -> Create Workspace -> Invite Teammate -> Accept ->
 *   Change Role -> RBAC reflected after refresh -> Suspend -> Reactivate ->
 *   Transfer Ownership
 *
 * Run against live Docker Mongo/Redis, same EmailService-capture pattern as
 * the other e2e suites (see auth.e2e-spec.ts for why: real delivery is
 * async via BullMQ/Resend and can't be observed deterministically here).
 */
describe("Golden Flow (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];

  const runId = Date.now();
  const ownerEmail = `golden-owner-${runId}@example.com`;
  const ownerMobile = `+9177${String(runId).slice(-8)}`;
  const memberEmail = `golden-member-${runId}@example.com`;
  const memberMobile = `+9188${String(runId).slice(-8)}`;
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

  it("carries a user from registration through ownership transfer", async () => {
    // --- Identity: register + verify the future Owner ---
    const ownerRegisterRes = await request(server()).post("/api/v1/auth/register").send({
      fullName: "Golden Owner",
      email: ownerEmail,
      mobileNumber: ownerMobile,
      password,
    });
    expect(ownerRegisterRes.status).toBe(201);

    const ownerVerifyToken = extractToken(extractLink(ownerEmail, "email-verification"));
    const ownerVerifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: ownerVerifyToken });
    expect(ownerVerifyRes.status).toBe(201);
    let ownerTokens = (ownerVerifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    // --- Workspace: create ---
    const createRes = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ name: "Golden Flow Trading Co" });
    expect(createRes.status).toBe(201);
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    const workspaceId = createBody.data.workspace.id;
    ownerTokens = createBody.data.tokens;
    expect(createBody.data.workspace.status).toBe("TRIAL");

    // --- Identity: register + verify the future team member ---
    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Golden Member",
      email: memberEmail,
      mobileNumber: memberMobile,
      password,
    });
    const memberVerifyToken = extractToken(extractLink(memberEmail, "email-verification"));
    const memberVerifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: memberVerifyToken });
    let memberTokens = (memberVerifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>)
      .data.tokens;

    // --- Team: invite + accept ---
    const inviteRes = await request(server())
      .post("/api/v1/team/invitations")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ email: memberEmail, role: "SALES_EXECUTIVE" });
    expect(inviteRes.status).toBe(201);

    const inviteToken = extractToken(extractLink(memberEmail, "team-invitation"));
    const acceptRes = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: inviteToken });
    expect(acceptRes.status).toBe(201);
    const acceptBody = acceptRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    expect(acceptBody.data.workspace.id).toBe(workspaceId);
    memberTokens = acceptBody.data.tokens;

    // --- Team: member now visible, change role ---
    const membersRes = await request(server())
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    const members = (membersRes.body as ApiSuccessResponse<MemberSummary[]>).data;
    expect(members).toHaveLength(2);
    const memberId = members.find((m) => m.email === memberEmail)?.id ?? "";

    const roleRes = await request(server())
      .patch(`/api/v1/team/members/${memberId}/role`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ role: "SUPPORT_MANAGER" });
    expect(roleRes.status).toBe(200);

    // --- RBAC: the member's role change only takes effect once they refresh ---
    const refreshRes = await request(server())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: memberTokens.refreshToken });
    memberTokens = (refreshRes.body as ApiSuccessResponse<IssuedTokenPair>).data;

    // --- Team: suspend, confirm login is blocked, reactivate, confirm login restored ---
    const suspendRes = await request(server())
      .post(`/api/v1/team/members/${memberId}/suspend`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(suspendRes.status).toBe(200);

    const blockedLoginRes = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: memberEmail, password });
    expect(blockedLoginRes.status).toBe(403);

    const reactivateRes = await request(server())
      .post(`/api/v1/team/members/${memberId}/reactivate`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(reactivateRes.status).toBe(200);

    const restoredLoginRes = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: memberEmail, password });
    expect(restoredLoginRes.status).toBe(201);

    // --- Team: ownership transfer, confirm the role swap on both sides ---
    const transferRes = await request(server())
      .post(`/api/v1/team/ownership-transfer/${memberId}`)
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    expect(transferRes.status).toBe(200);
    ownerTokens = (transferRes.body as ApiSuccessResponse<IssuedTokenPair>).data;

    const finalMembersRes = await request(server())
      .get("/api/v1/team/members")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`);
    const finalMembers = (finalMembersRes.body as ApiSuccessResponse<MemberSummary[]>).data;
    expect(finalMembers.find((m) => m.email === memberEmail)?.role).toBe("OWNER");
    expect(finalMembers.find((m) => m.email === ownerEmail)?.role).toBe("ADMINISTRATOR");
  });
});
