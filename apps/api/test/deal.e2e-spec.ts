import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import { Types } from "mongoose";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import { PhoneNumberRepository } from "../src/modules/communication/repositories/phone-number.repository.js";
import { WhatsAppConnectionRepository } from "../src/modules/communication/repositories/whatsapp-connection.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type {
  DealSummary,
  LeadConversionResult,
  LeadSummary,
} from "../src/modules/crm/crm.types.js";

/**
 * Covers Phase-5 Part-4 (PRD-004 Volume-4, Deal Management) end-to-end
 * against the real replica-set Mongo: the full pipeline (OPEN through WON,
 * and the OPEN-through-LOST alternative), the CREATE_DEALS/CLOSE_DEALS
 * permission split (Sales Executive can move non-terminal stages but not
 * close; Owner/Sales Manager can), Lost Reason mandatoriness (BR-007),
 * reopen (LOST only, always resets to OPEN), assignment eligibility
 * (Sales Executive only), field immutability (no direct creation, no
 * delete), and Lead Conversion's assignedTo/title carry-forward.
 */
describe("Deal Management (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;

  const runId = Date.now();
  const ownerEmail = `deal-owner-${runId}@example.com`;
  const ownerMobile = `+9319${String(runId).slice(-8)}`;
  const execEmail = `deal-exec-${runId}@example.com`;
  const execMobile = `+9329${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-deal-${runId}`;
  const wonPathMobile = `+9341${String(runId).slice(-7)}1`;
  const lostPathMobile = `+9341${String(runId).slice(-7)}2`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;
  let salesExecutiveId: string;

  beforeAll(async () => {
    sentEmails = [];
    const metaApiClient = { sendTextMessage: jest.fn(), sendTemplateMessage: jest.fn() };

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
      .overrideProvider(MetaApiClient)
      .useValue(metaApiClient)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    connectionRepository = moduleRef.get(WhatsAppConnectionRepository);
    const tokenEncryption = moduleRef.get(TokenEncryptionService);

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Deal Owner",
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
      .send({ name: "Deal Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    ownerAccessToken = createBody.data.tokens.accessToken;

    await phoneNumberRepository.upsert(
      workspaceId,
      new Types.ObjectId().toString(),
      metaPhoneNumberId,
      {
        displayPhoneNumber: "+91 90000 00010",
        verifiedName: "Deal Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-deal-${runId}`,
      businessName: "Deal Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    const exec = await inviteAndAccept(execEmail, execMobile, "Exec", "SALES_EXECUTIVE");
    salesExecutiveAccessToken = exec.accessToken;
    salesExecutiveId = exec.userId;
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
  ): Promise<{ accessToken: string; userId: string }> {
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
    const acceptBody = (
      acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair; workspace: WorkspaceProfile }>
    ).data;

    const meRes = await request(server())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${acceptBody.tokens.accessToken}`);
    const userId = (meRes.body as ApiSuccessResponse<{ id: string }>).data.id;

    return { accessToken: acceptBody.tokens.accessToken, userId };
  }

  async function createLeadWonAndConvert(
    leadName: string,
    mobileNumber: string,
    assignToExecutive: boolean,
  ): Promise<{ leadId: string; dealId: string; customerId: string }> {
    const createRes = await authed("post", "/api/v1/crm/leads").send({
      leadName,
      mobileNumber,
      source: "MANUAL_ENTRY",
    });
    const lead = (createRes.body as ApiSuccessResponse<LeadSummary>).data;

    if (assignToExecutive) {
      await authed("patch", `/api/v1/crm/leads/${lead.id}/assign`).send({
        assignedUserId: salesExecutiveId,
      });
    }

    const path = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    for (const status of path) {
      await authed("patch", `/api/v1/crm/leads/${lead.id}/status`).send({ status });
    }

    const convertRes = await authed("post", `/api/v1/crm/leads/${lead.id}/convert`);
    const result = (convertRes.body as ApiSuccessResponse<LeadConversionResult>).data;

    return { leadId: lead.id, dealId: result.dealId, customerId: result.customerId };
  }

  let wonPathDealId: string;
  let wonPathCustomerId: string;

  it("Lead Conversion creates a Deal with title/assignedTo carried forward from the Lead, stage OPEN", async () => {
    const { dealId, customerId } = await createLeadWonAndConvert(
      "Won Path Opportunity",
      wonPathMobile,
      true,
    );
    wonPathDealId = dealId;
    wonPathCustomerId = customerId;

    const res = await authed("get", `/api/v1/crm/deals/${dealId}`);
    expect(res.status).toBe(200);
    const deal = (res.body as ApiSuccessResponse<DealSummary>).data;
    expect(deal.title).toBe("Won Path Opportunity");
    expect(deal.assignedTo).toBe(salesExecutiveId);
    expect(deal.stage).toBe("OPEN");
    expect(deal.customerId).toBe(customerId);
    expect(deal.value).toBe(0);
    expect(deal.currency).toBe("INR");
    expect(deal.probability).toBe(0);
  });

  it("has no direct creation or delete endpoint", async () => {
    const createRes = await authed("post", "/api/v1/crm/deals").send({ title: "Should not work" });
    expect(createRes.status).toBe(404);

    const deleteRes = await authed("delete", `/api/v1/crm/deals/${wonPathDealId}`);
    expect(deleteRes.status).toBe(404);
  });

  it("updates general fields via PATCH /:id", async () => {
    const res = await authed("patch", `/api/v1/crm/deals/${wonPathDealId}`).send({
      value: 75000,
      probability: 40,
      description: "Updated during pipeline review",
      expectedCloseDate: "2026-09-30T00:00:00.000Z",
    });

    expect(res.status).toBe(200);
    const deal = (res.body as ApiSuccessResponse<DealSummary>).data;
    expect(deal.value).toBe(75000);
    expect(deal.probability).toBe(40);
    expect(deal.description).toBe("Updated during pipeline review");
    expect(deal.expectedCloseDate).toBe("2026-09-30T00:00:00.000Z");
  });

  it("a Sales Executive can move non-terminal stages but is forbidden from closing (WON)", async () => {
    const nonTerminalPath = ["QUALIFICATION", "PROPOSAL", "NEGOTIATION"];
    for (const stage of nonTerminalPath) {
      const res = await authed(
        "patch",
        `/api/v1/crm/deals/${wonPathDealId}/stage`,
        salesExecutiveAccessToken,
      ).send({ stage });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<DealSummary>).data.stage).toBe(stage);
    }

    const closeAttempt = await authed(
      "patch",
      `/api/v1/crm/deals/${wonPathDealId}/stage`,
      salesExecutiveAccessToken,
    ).send({ stage: "WON" });
    expect(closeAttempt.status).toBe(403);
  });

  it("an Owner (has CLOSE_DEALS) can close the Deal as WON, setting wonAt", async () => {
    const res = await authed("patch", `/api/v1/crm/deals/${wonPathDealId}/stage`).send({
      stage: "WON",
    });

    expect(res.status).toBe(200);
    const deal = (res.body as ApiSuccessResponse<DealSummary>).data;
    expect(deal.stage).toBe("WON");
    expect(deal.wonAt).not.toBeNull();
    expect(deal.lostAt).toBeNull();
  });

  it("rejects any further stage change on a WON (terminal) Deal, including reopen", async () => {
    const stageRes = await authed("patch", `/api/v1/crm/deals/${wonPathDealId}/stage`).send({
      stage: "OPEN",
    });
    expect(stageRes.status).toBe(400);

    const reopenRes = await authed("post", `/api/v1/crm/deals/${wonPathDealId}/reopen`);
    expect(reopenRes.status).toBe(400);
  });

  let lostPathDealId: string;

  it("LOST is reachable directly from OPEN (not just after progressing through the pipeline)", async () => {
    const { dealId } = await createLeadWonAndConvert(
      "Lost Path Opportunity",
      lostPathMobile,
      false,
    );
    lostPathDealId = dealId;

    const noReasonRes = await authed("patch", `/api/v1/crm/deals/${dealId}/stage`).send({
      stage: "LOST",
    });
    expect(noReasonRes.status).toBe(400);

    const res = await authed("patch", `/api/v1/crm/deals/${dealId}/stage`).send({
      stage: "LOST",
      lostReason: "PRICE",
    });
    expect(res.status).toBe(200);
    const deal = (res.body as ApiSuccessResponse<DealSummary>).data;
    expect(deal.stage).toBe("LOST");
    expect(deal.lostReason).toBe("PRICE");
    expect(deal.lostAt).not.toBeNull();
  });

  it("a Sales Executive is forbidden from reopening a LOST Deal (needs CLOSE_DEALS)", async () => {
    const res = await authed(
      "post",
      `/api/v1/crm/deals/${lostPathDealId}/reopen`,
      salesExecutiveAccessToken,
    );
    expect(res.status).toBe(403);
  });

  it("an Owner can reopen a LOST Deal, always resetting to OPEN and clearing the Lost outcome", async () => {
    const res = await authed("post", `/api/v1/crm/deals/${lostPathDealId}/reopen`);
    expect(res.status).toBe(201);
    const deal = (res.body as ApiSuccessResponse<DealSummary>).data;
    expect(deal.stage).toBe("OPEN");
    expect(deal.lostAt).toBeNull();
    expect(deal.lostReason).toBeNull();
  });

  it("rejects reopening a Deal that isn't LOST", async () => {
    const res = await authed("post", `/api/v1/crm/deals/${lostPathDealId}/reopen`);
    expect(res.status).toBe(400);
  });

  it("assigns to an eligible Sales Executive, rejects an ineligible assignee, and unassigns", async () => {
    const assignRes = await authed("patch", `/api/v1/crm/deals/${lostPathDealId}/assign`).send({
      assignedTo: salesExecutiveId,
    });
    expect(assignRes.status).toBe(200);
    expect((assignRes.body as ApiSuccessResponse<DealSummary>).data.assignedTo).toBe(
      salesExecutiveId,
    );

    const ineligibleRes = await authed("patch", `/api/v1/crm/deals/${lostPathDealId}/assign`).send({
      assignedTo: "not-a-real-user-id",
    });
    expect(ineligibleRes.status).toBe(400);

    const unassignRes = await authed("patch", `/api/v1/crm/deals/${lostPathDealId}/assign`).send({
      assignedTo: null,
    });
    expect(unassignRes.status).toBe(200);
    expect((unassignRes.body as ApiSuccessResponse<DealSummary>).data.assignedTo).toBeNull();
  });

  it("lists, filters by stage/customer, and searches by title", async () => {
    const listRes = await authed("get", "/api/v1/crm/deals?stage=OPEN");
    const listed = (listRes.body as ApiSuccessResponse<DealSummary[]>).data;
    expect(listed.some((d) => d.id === lostPathDealId)).toBe(true);

    const customerRes = await authed("get", `/api/v1/crm/deals?customerId=${wonPathCustomerId}`);
    const byCustomer = (customerRes.body as ApiSuccessResponse<DealSummary[]>).data;
    expect(byCustomer.some((d) => d.id === wonPathDealId)).toBe(true);

    const searchRes = await authed("get", "/api/v1/crm/deals/search?q=Lost Path");
    const searched = (searchRes.body as ApiSuccessResponse<DealSummary[]>).data;
    expect(searched.some((d) => d.id === lostPathDealId)).toBe(true);
  });
});
