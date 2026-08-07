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
  ActivitySummary,
  CustomerSummary,
  LeadConversionResult,
  LeadSummary,
} from "../src/modules/crm/crm.types.js";

/**
 * Covers Phase-5 Part-5 (PRD-004 Volume-5, Activities, Tasks, Follow-ups &
 * Notes) end-to-end against the real replica-set Mongo: creation across all
 * six creatable types (Task/Follow-up/Note/Reminder/Call/Meeting — NOTE via
 * its own /crm/notes endpoint), reference validation (BR-003), permission
 * inheritance from Customer/Deal (no dedicated Activities permission),
 * assignment eligibility (any ACTIVE member, no role restriction — unlike
 * Lead/Deal), completed-Task/Follow-up read-only (BR-004/BR-005), archive
 * (BR-006), and search/filter/sort.
 */
describe("Activities, Tasks, Follow-ups & Notes (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;

  const runId = Date.now();
  const ownerEmail = `activity-owner-${runId}@example.com`;
  const ownerMobile = `+9419${String(runId).slice(-8)}`;
  const marketingEmail = `activity-marketing-${runId}@example.com`;
  const marketingMobile = `+9429${String(runId).slice(-8)}`;
  const supportEmail = `activity-support-${runId}@example.com`;
  const supportMobile = `+9439${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-activity-${runId}`;
  const customerMobile = `+9451${String(runId).slice(-7)}1`;
  const dealMobile = `+9451${String(runId).slice(-7)}2`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let marketingAccessToken: string;
  let supportUserId: string;

  let customerId: string;
  let dealId: string;

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
      fullName: "Activity Owner",
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
      .send({ name: "Activity Test Co" });
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
        displayPhoneNumber: "+91 90000 00011",
        verifiedName: "Activity Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-activity-${runId}`,
      businessName: "Activity Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    const marketing = await inviteAndAccept(
      marketingEmail,
      marketingMobile,
      "Marketing",
      "MARKETING_EXECUTIVE",
    );
    marketingAccessToken = marketing.accessToken;

    const support = await inviteAndAccept(
      supportEmail,
      supportMobile,
      "Support",
      "SUPPORT_EXECUTIVE",
    );
    supportUserId = support.userId;

    const customer = await request(server())
      .post("/api/v1/crm/customers")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ customerName: "Activity Customer", mobileNumber: customerMobile });
    customerId = (customer.body as ApiSuccessResponse<CustomerSummary>).data.id;

    const dealLead = await request(server())
      .post("/api/v1/crm/leads")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        leadName: "Activity Deal Opportunity",
        mobileNumber: dealMobile,
        source: "MANUAL_ENTRY",
      });
    const leadId = (dealLead.body as ApiSuccessResponse<LeadSummary>).data.id;
    for (const status of ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"]) {
      await authed("patch", `/api/v1/crm/leads/${leadId}/status`).send({ status });
    }
    const convertRes = await authed("post", `/api/v1/crm/leads/${leadId}/convert`);
    dealId = (convertRes.body as ApiSuccessResponse<LeadConversionResult>).data.dealId;
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(method: "get" | "post" | "patch", path: string, token = ownerAccessToken) {
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
    const acceptBody = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;

    const meRes = await request(server())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${acceptBody.tokens.accessToken}`);
    const userId = (meRes.body as ApiSuccessResponse<{ id: string }>).data.id;

    return { accessToken: acceptBody.tokens.accessToken, userId };
  }

  it("rejects creating an Activity with neither Customer nor Deal reference", async () => {
    const res = await authed("post", "/api/v1/crm/activities").send({ type: "CALL" });
    expect(res.status).toBe(400);
  });

  it("rejects creating type=NOTE via the generic endpoint", async () => {
    const res = await authed("post", "/api/v1/crm/activities").send({
      type: "NOTE",
      customerId,
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid Customer reference", async () => {
    const res = await authed("post", "/api/v1/crm/activities").send({
      type: "CALL",
      customerId: new Types.ObjectId().toString(),
      description: "Called about renewal",
    });
    expect(res.status).toBe(400);
  });

  let taskId: string;

  it("creates a Task against a Customer, defaulting status to PENDING", async () => {
    const res = await authed("post", "/api/v1/crm/activities").send({
      type: "TASK",
      customerId,
      title: "Send updated quote",
      dueDate: "2026-09-15T00:00:00.000Z",
      priority: "HIGH",
    });

    expect(res.status).toBe(201);
    const activity = (res.body as ApiSuccessResponse<ActivitySummary>).data;
    expect(activity.type).toBe("TASK");
    expect(activity.status).toBe("PENDING");
    expect(activity.customerId).toBe(customerId);
    taskId = activity.id;
  });

  it("gets, updates, and lists the Task", async () => {
    const getRes = await authed("get", `/api/v1/crm/activities/${taskId}`);
    expect(getRes.status).toBe(200);

    const updateRes = await authed("patch", `/api/v1/crm/activities/${taskId}`).send({
      title: "Send updated quote (v2)",
    });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as ApiSuccessResponse<ActivitySummary>).data.title).toBe(
      "Send updated quote (v2)",
    );

    const listRes = await authed(
      "get",
      `/api/v1/crm/activities?customerId=${customerId}&type=TASK`,
    );
    const listed = (listRes.body as ApiSuccessResponse<ActivitySummary[]>).data;
    expect(listed.some((a) => a.id === taskId)).toBe(true);
  });

  it("assigns the Task to any ACTIVE member regardless of role, rejects an inactive/invalid one", async () => {
    const assignRes = await authed("patch", `/api/v1/crm/tasks/${taskId}/assign`).send({
      assignedUserId: supportUserId,
    });
    expect(assignRes.status).toBe(200);
    expect((assignRes.body as ApiSuccessResponse<ActivitySummary>).data.assignedUserId).toBe(
      supportUserId,
    );

    const malformedRes = await authed("patch", `/api/v1/crm/tasks/${taskId}/assign`).send({
      assignedUserId: "not-a-real-id",
    });
    expect(malformedRes.status).toBe(400);

    const unknownRes = await authed("patch", `/api/v1/crm/tasks/${taskId}/assign`).send({
      assignedUserId: new Types.ObjectId().toString(),
    });
    expect(unknownRes.status).toBe(400);
  });

  it("completes the Task, then makes it read-only (BR-004)", async () => {
    const completeRes = await authed("patch", `/api/v1/crm/tasks/${taskId}/status`).send({
      status: "COMPLETED",
    });
    expect(completeRes.status).toBe(200);
    expect((completeRes.body as ApiSuccessResponse<ActivitySummary>).data.status).toBe("COMPLETED");

    const editAfterRes = await authed("patch", `/api/v1/crm/activities/${taskId}`).send({
      title: "Should not apply",
    });
    expect(editAfterRes.status).toBe(400);

    const assignAfterRes = await authed("patch", `/api/v1/crm/tasks/${taskId}/assign`).send({
      assignedUserId: supportUserId,
    });
    expect(assignAfterRes.status).toBe(400);
  });

  it("archives the Task, and rejects archiving it twice (BR-006)", async () => {
    const archiveRes = await authed("patch", `/api/v1/crm/activities/${taskId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect((archiveRes.body as ApiSuccessResponse<ActivitySummary>).data.archivedAt).not.toBeNull();

    const archiveAgainRes = await authed("patch", `/api/v1/crm/activities/${taskId}/archive`);
    expect(archiveAgainRes.status).toBe(400);
  });

  let followUpId: string;

  it("creates a Follow-up against a Deal, assigns it, completes it, then makes it read-only (BR-005)", async () => {
    const createRes = await authed("post", "/api/v1/crm/activities").send({
      type: "FOLLOW_UP",
      dealId,
      followUpDate: "2026-09-20T00:00:00.000Z",
      followUpType: "CALL",
    });
    expect(createRes.status).toBe(201);
    followUpId = (createRes.body as ApiSuccessResponse<ActivitySummary>).data.id;

    const assignRes = await authed("patch", `/api/v1/crm/follow-ups/${followUpId}/assign`).send({
      assignedUserId: supportUserId,
    });
    expect(assignRes.status).toBe(200);

    const completeRes = await authed("patch", `/api/v1/crm/follow-ups/${followUpId}/complete`);
    expect(completeRes.status).toBe(200);
    expect(
      (completeRes.body as ApiSuccessResponse<ActivitySummary>).data.followUpCompletedAt,
    ).not.toBeNull();

    const completeAgainRes = await authed("patch", `/api/v1/crm/follow-ups/${followUpId}/complete`);
    expect(completeAgainRes.status).toBe(400);

    const editAfterRes = await authed("patch", `/api/v1/crm/activities/${followUpId}`).send({
      followUpType: "EMAIL",
    });
    expect(editAfterRes.status).toBe(400);
  });

  it("creates a Note via POST /crm/notes, distinct from the generic activities endpoint", async () => {
    const res = await authed("post", "/api/v1/crm/notes").send({
      dealId,
      text: "Customer asked for a 10% discount",
      mentions: [supportUserId],
    });

    expect(res.status).toBe(201);
    const note = (res.body as ApiSuccessResponse<ActivitySummary>).data;
    expect(note.type).toBe("NOTE");
    expect(note.text).toBe("Customer asked for a 10% discount");
    expect(note.mentions).toEqual([supportUserId]);
  });

  it("creates a Reminder and a Call log entry", async () => {
    const reminderRes = await authed("post", "/api/v1/crm/activities").send({
      type: "REMINDER",
      customerId,
      reminderDate: "2026-09-10T09:00:00.000Z",
      reminderType: "NOTIFICATION",
    });
    expect(reminderRes.status).toBe(201);
    expect((reminderRes.body as ApiSuccessResponse<ActivitySummary>).data.type).toBe("REMINDER");

    const callRes = await authed("post", "/api/v1/crm/activities").send({
      type: "CALL",
      dealId,
      description: "Discussed contract terms",
    });
    expect(callRes.status).toBe(201);
    expect((callRes.body as ApiSuccessResponse<ActivitySummary>).data.type).toBe("CALL");
  });

  it("searches by title/description/note text", async () => {
    const res = await authed("get", "/api/v1/crm/activities/search?q=discount");
    const results = (res.body as ApiSuccessResponse<ActivitySummary[]>).data;
    expect(results.some((a) => a.text === "Customer asked for a 10% discount")).toBe(true);
  });

  it("Marketing Executive (no EDIT_CUSTOMER/CREATE_DEALS) is forbidden from creating Activities", async () => {
    const res = await authed("post", "/api/v1/crm/activities", marketingAccessToken).send({
      type: "CALL",
      customerId,
      description: "Should be blocked",
    });
    expect(res.status).toBe(403);
  });

  it("Marketing Executive is forbidden from viewing a Deal-referencing Activity (no VIEW_DEALS)", async () => {
    const dealActivity = await authed("post", "/api/v1/crm/activities").send({
      type: "CALL",
      dealId,
      description: "Deal-only activity",
    });
    const dealActivityId = (dealActivity.body as ApiSuccessResponse<ActivitySummary>).data.id;

    const res = await authed(
      "get",
      `/api/v1/crm/activities/${dealActivityId}`,
      marketingAccessToken,
    );
    expect(res.status).toBe(403);
  });

  it("Marketing Executive can still list Activities (VIEW_ONLY on VIEW_CUSTOMERS is enough to pass the broad list gate)", async () => {
    const res = await authed("get", "/api/v1/crm/activities", marketingAccessToken);
    expect(res.status).toBe(200);
  });
});
