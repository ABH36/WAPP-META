import { createHmac } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import { Types } from "mongoose";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { MemberSummary, WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import { PhoneNumberRepository } from "../src/modules/communication/repositories/phone-number.repository.js";
import { WhatsAppConnectionRepository } from "../src/modules/communication/repositories/whatsapp-connection.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type { AppConfig } from "../src/config/configuration.js";
import type { CustomerSummary, LeadSummary } from "../src/modules/crm/crm.types.js";

/**
 * Covers Phase-5 Part-2 (PRD-004 Volume-2, Lead Management) end-to-end
 * against real Docker Mongo/Redis: all three Part-2 creation methods
 * (Manual Entry, WhatsApp Conversation, Existing Customer Upsell), the
 * auto-link-existing-Customer rule (§11), duplicate prevention, assignment
 * eligibility, the full status pipeline, and archive-is-read-only.
 */
describe("Lead Management (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let appSecret: string;

  const runId = Date.now();
  const ownerEmail = `lead-owner-${runId}@example.com`;
  const ownerMobile = `+9119${String(runId).slice(-8)}`;
  const agentEmail = `lead-agent-${runId}@example.com`;
  const agentMobile = `+9129${String(runId).slice(-8)}`;
  const managerEmail = `lead-manager-${runId}@example.com`;
  const managerMobile = `+9139${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-lead-${runId}`;
  const manualMobile = `+9131${String(runId).slice(-7)}1`;
  const whatsappMobile = `+9131${String(runId).slice(-7)}2`;
  const upsellMobile = `+9131${String(runId).slice(-7)}3`;
  const autoLinkMobile = `+9131${String(runId).slice(-7)}4`;
  const illegalTransitionMobile = `+9131${String(runId).slice(-7)}5`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let salesExecutiveId: string;
  let salesManagerId: string;

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
    const configService = moduleRef.get<ConfigService<AppConfig, true>>(ConfigService);
    appSecret = configService.get("meta", { infer: true }).appSecret;

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Lead Owner",
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
      .send({ name: "Lead Test Co" });
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
        displayPhoneNumber: "+91 90000 00008",
        verifiedName: "Lead Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-lead-${runId}`,
      businessName: "Lead Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    salesExecutiveId = await inviteAndAccept(agentEmail, agentMobile, "Agent", "SALES_EXECUTIVE");
    salesManagerId = await inviteAndAccept(managerEmail, managerMobile, "Manager", "SALES_MANAGER");
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(method: "get" | "post" | "patch", path: string) {
    return request(server())[method](path).set("Authorization", `Bearer ${ownerAccessToken}`);
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
    await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: inviteToken });

    const membersRes = await authed("get", "/api/v1/team/members");
    const members = (membersRes.body as ApiSuccessResponse<MemberSummary[]>).data;
    const member = members.find((m) => m.email === email);
    if (!member) {
      throw new Error(`Member ${email} not found after accepting invitation`);
    }
    return member.id;
  }

  async function createCustomer(
    mobileNumber: string,
    customerName: string,
  ): Promise<CustomerSummary> {
    const res = await authed("post", "/api/v1/crm/customers").send({ customerName, mobileNumber });
    return (res.body as ApiSuccessResponse<CustomerSummary>).data;
  }

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("waitFor timed out");
  }

  async function createContactViaWhatsApp(from: string): Promise<void> {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-e2e",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: metaPhoneNumberId },
                contacts: [{ profile: { name: "WhatsApp Contact" }, wa_id: from.slice(1) }],
                messages: [
                  {
                    from: from.slice(1),
                    id: `wamid.lead-${runId}-${from}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Hi" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const json = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", appSecret).update(Buffer.from(json)).digest("hex")}`;
    await request(server())
      .post("/api/webhooks/whatsapp")
      .type("json")
      .set("X-Hub-Signature-256", signature)
      .send(json)
      .expect(200);
  }

  async function findContactIdByPhone(phone: string): Promise<string> {
    const res = await authed("get", "/api/v1/communication/conversations");
    const conversations = (
      res.body as ApiSuccessResponse<
        Array<{ id: string; contactId: string; contactPhoneNumber: string | null }>
      >
    ).data;
    const found = conversations.find((c) => c.contactPhoneNumber === phone);
    if (!found) throw new Error(`No conversation/contact found for ${phone}`);
    return found.contactId;
  }

  let manualLeadId: string;

  it("Method 1 (Manual Entry): resolves/creates the Contact, no Customer link", async () => {
    const res = await authed("post", "/api/v1/crm/leads").send({
      leadName: "Acme Opportunity",
      mobileNumber: manualMobile,
      source: "MANUAL_ENTRY",
    });

    expect(res.status).toBe(201);
    const lead = (res.body as ApiSuccessResponse<LeadSummary>).data;
    expect(lead.mobileNumber).toBe(manualMobile);
    expect(lead.source).toBe("MANUAL_ENTRY");
    expect(lead.status).toBe("NEW");
    expect(lead.customerId).toBeNull();
    manualLeadId = lead.id;
  });

  it("rejects a duplicate active Lead for the same mobile number", async () => {
    const res = await authed("post", "/api/v1/crm/leads").send({
      leadName: "Acme Opportunity Duplicate",
      mobileNumber: manualMobile,
      source: "MANUAL_ENTRY",
    });

    expect(res.status).toBe(409);
  });

  it("Method 2 (WhatsApp Conversation): sources from a real inbound-message Contact", async () => {
    await createContactViaWhatsApp(whatsappMobile);
    let contactId = "";
    await waitFor(async () => {
      try {
        contactId = await findContactIdByPhone(whatsappMobile);
        return true;
      } catch {
        return false;
      }
    });

    const res = await authed("post", "/api/v1/crm/leads").send({
      leadName: "WhatsApp Lead",
      contactId,
      source: "WHATSAPP",
    });

    expect(res.status).toBe(201);
    const lead = (res.body as ApiSuccessResponse<LeadSummary>).data;
    expect(lead.mobileNumber).toBe(whatsappMobile);
    expect(lead.contactId).toBe(contactId);
  });

  it("Method 3 (Existing Customer Upsell): links the Customer's own Contact and sets customerId directly", async () => {
    const customer = await createCustomer(upsellMobile, "Upsell Customer");

    const res = await authed("post", "/api/v1/crm/leads").send({
      leadName: "Upsell Opportunity",
      customerId: customer.id,
      source: "EXISTING_CUSTOMER",
    });

    expect(res.status).toBe(201);
    const lead = (res.body as ApiSuccessResponse<LeadSummary>).data;
    expect(lead.customerId).toBe(customer.id);
    expect(lead.contactId).toBe(customer.contactId);
    expect(lead.mobileNumber).toBe(upsellMobile);
  });

  it("auto-links an existing Customer even when created via Method 1 (§11)", async () => {
    const customer = await createCustomer(autoLinkMobile, "Auto Link Customer");

    const res = await authed("post", "/api/v1/crm/leads").send({
      leadName: "Auto Link Opportunity",
      mobileNumber: autoLinkMobile,
      source: "MANUAL_ENTRY",
    });

    expect(res.status).toBe(201);
    const lead = (res.body as ApiSuccessResponse<LeadSummary>).data;
    expect(lead.customerId).toBe(customer.id);
  });

  it("gets a Lead by id, lists by status, and searches by name", async () => {
    const getRes = await authed("get", `/api/v1/crm/leads/${manualLeadId}`);
    expect(getRes.status).toBe(200);
    expect((getRes.body as ApiSuccessResponse<LeadSummary>).data.leadName).toBe("Acme Opportunity");

    const listRes = await authed("get", "/api/v1/crm/leads?status=NEW");
    const listed = (listRes.body as ApiSuccessResponse<LeadSummary[]>).data;
    expect(listed.some((l) => l.id === manualLeadId)).toBe(true);

    const searchRes = await authed("get", "/api/v1/crm/leads/search?q=Acme");
    const searched = (searchRes.body as ApiSuccessResponse<LeadSummary[]>).data;
    expect(searched.some((l) => l.id === manualLeadId)).toBe(true);
  });

  it("updates business-profile fields via the general update endpoint", async () => {
    const res = await authed("patch", `/api/v1/crm/leads/${manualLeadId}`).send({
      company: "Acme Inc",
      expectedValue: 50000,
    });

    expect(res.status).toBe(200);
    const updated = (res.body as ApiSuccessResponse<LeadSummary>).data;
    expect(updated.company).toBe("Acme Inc");
    expect(updated.expectedValue).toBe(50000);
  });

  it("assigns to an eligible Sales Executive, rejects an ineligible role, and unassigns", async () => {
    const assignRes = await authed("patch", `/api/v1/crm/leads/${manualLeadId}/assign`).send({
      assignedUserId: salesExecutiveId,
    });
    expect(assignRes.status).toBe(200);
    expect((assignRes.body as ApiSuccessResponse<LeadSummary>).data.assignedUserId).toBe(
      salesExecutiveId,
    );

    const ineligibleRes = await authed("patch", `/api/v1/crm/leads/${manualLeadId}/assign`).send({
      assignedUserId: salesManagerId,
    });
    expect(ineligibleRes.status).toBe(400);

    const unassignRes = await authed("patch", `/api/v1/crm/leads/${manualLeadId}/assign`).send({
      assignedUserId: null,
    });
    expect(unassignRes.status).toBe(200);
    expect((unassignRes.body as ApiSuccessResponse<LeadSummary>).data.assignedUserId).toBeNull();
  });

  let illegalJumpLeadId: string;

  it("walks the full status pipeline to WON and rejects an illegal jump", async () => {
    const current = manualLeadId;
    const path: string[] = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    for (const status of path) {
      const res = await authed("patch", `/api/v1/crm/leads/${current}/status`).send({ status });
      expect(res.status).toBe(200);
      expect((res.body as ApiSuccessResponse<LeadSummary>).data.status).toBe(status);
    }

    // Fresh Lead for the illegal-jump check: NEW cannot go straight to WON.
    const freshRes = await authed("post", "/api/v1/crm/leads").send({
      leadName: "Illegal Jump Lead",
      mobileNumber: illegalTransitionMobile,
      source: "MANUAL_ENTRY",
    });
    const freshLead = (freshRes.body as ApiSuccessResponse<LeadSummary>).data;
    illegalJumpLeadId = freshLead.id;

    const illegalRes = await authed("patch", `/api/v1/crm/leads/${freshLead.id}/status`).send({
      status: "WON",
    });
    expect(illegalRes.status).toBe(400);
  });

  it("archives a Lead and makes it read-only", async () => {
    // manualLeadId is already WON (terminal) from the previous test — using
    // the still-NEW illegalJumpLeadId instead so the status-change check
    // below is actually testing "blocked because archived," not "blocked
    // because WON has no further legal transitions."
    const archiveRes = await authed("patch", `/api/v1/crm/leads/${illegalJumpLeadId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect((archiveRes.body as ApiSuccessResponse<LeadSummary>).data.archivedAt).not.toBeNull();

    const archiveAgainRes = await authed("patch", `/api/v1/crm/leads/${illegalJumpLeadId}/archive`);
    expect(archiveAgainRes.status).toBe(400);

    const editRes = await authed("patch", `/api/v1/crm/leads/${illegalJumpLeadId}`).send({
      company: "Should Not Apply",
    });
    expect(editRes.status).toBe(400);

    const statusRes = await authed("patch", `/api/v1/crm/leads/${illegalJumpLeadId}/status`).send({
      status: "LOST",
    });
    expect(statusRes.status).toBe(400);

    const assignRes = await authed("patch", `/api/v1/crm/leads/${illegalJumpLeadId}/assign`).send({
      assignedUserId: salesExecutiveId,
    });
    expect(assignRes.status).toBe(400);

    // Archived Leads remain searchable.
    const searchRes = await authed("get", "/api/v1/crm/leads/search?q=Illegal");
    const searched = (searchRes.body as ApiSuccessResponse<LeadSummary[]>).data;
    expect(searched.some((l) => l.id === illegalJumpLeadId)).toBe(true);
  });
});
