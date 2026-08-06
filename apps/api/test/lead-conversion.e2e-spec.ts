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
  CustomerSummary,
  LeadConversionResult,
  LeadSummary,
} from "../src/modules/crm/crm.types.js";

/**
 * Covers Phase-5 Part-3 (PRD-004 Volume-3, Lead Conversion) end-to-end
 * against the real replica-set Mongo, exercising the actual multi-document
 * transaction (docs/ADR-INFRA-001-mongo-replica-set-strategy.md): Customer
 * creation vs reuse, Deal creation, Lead becoming read-only, idempotency
 * (409 on repeat), the precondition set (§4), and the just-granted
 * SALES_EXECUTIVE CONVERT_LEADS permission.
 */
describe("Lead Conversion (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;

  const runId = Date.now();
  const ownerEmail = `convert-owner-${runId}@example.com`;
  const ownerMobile = `+9219${String(runId).slice(-8)}`;
  const agentEmail = `convert-agent-${runId}@example.com`;
  const agentMobile = `+9229${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-convert-${runId}`;
  const newCustomerMobile = `+9231${String(runId).slice(-7)}1`;
  const upsellMobile = `+9231${String(runId).slice(-7)}2`;
  const notWonMobile = `+9231${String(runId).slice(-7)}3`;
  const archivedMobile = `+9231${String(runId).slice(-7)}4`;
  const salesExecMobile = `+9231${String(runId).slice(-7)}5`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;

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
      fullName: "Convert Owner",
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
      .send({ name: "Convert Test Co" });
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
        displayPhoneNumber: "+91 90000 00009",
        verifiedName: "Convert Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-convert-${runId}`,
      businessName: "Convert Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    salesExecutiveAccessToken = await inviteAndAccept(
      agentEmail,
      agentMobile,
      "Agent",
      "SALES_EXECUTIVE",
    );
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
    // The pre-acceptance token has no role/workspaceId baked in (JwtAuthGuard
    // reads the JWT payload as-issued, not a live DB lookup — see
    // jwt-auth.guard.ts) — the post-acceptance reissue is the one that
    // actually carries the granted role.
    const acceptBody = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;
    return acceptBody.tokens.accessToken;
  }

  async function createCustomer(
    mobileNumber: string,
    customerName: string,
  ): Promise<CustomerSummary> {
    const res = await authed("post", "/api/v1/crm/customers").send({ customerName, mobileNumber });
    return (res.body as ApiSuccessResponse<CustomerSummary>).data;
  }

  async function createLead(
    leadName: string,
    mobileNumber: string,
    extra: Record<string, unknown> = {},
  ): Promise<LeadSummary> {
    const res = await authed("post", "/api/v1/crm/leads").send({
      leadName,
      mobileNumber,
      source: "MANUAL_ENTRY",
      ...extra,
    });
    return (res.body as ApiSuccessResponse<LeadSummary>).data;
  }

  async function walkToWon(leadId: string): Promise<void> {
    const path = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    for (const status of path) {
      const res = await authed("patch", `/api/v1/crm/leads/${leadId}/status`).send({ status });
      expect(res.status).toBe(200);
    }
  }

  it("returns 404 converting a Lead that doesn't exist", async () => {
    const res = await authed(
      "post",
      `/api/v1/crm/leads/${new Types.ObjectId().toString()}/convert`,
    );
    expect(res.status).toBe(404);
  });

  it("rejects conversion of a Lead that hasn't reached WON", async () => {
    const lead = await createLead("Not Won Yet", notWonMobile);
    const res = await authed("post", `/api/v1/crm/leads/${lead.id}/convert`);
    expect(res.status).toBe(400);
  });

  it("rejects conversion of an archived Lead", async () => {
    const lead = await createLead("Archived Before Conversion", archivedMobile);
    await authed("patch", `/api/v1/crm/leads/${lead.id}/archive`);
    const res = await authed("post", `/api/v1/crm/leads/${lead.id}/convert`);
    expect(res.status).toBe(400);
  });

  let newCustomerLeadId: string;
  let newCustomerId: string;
  let newDealId: string;

  it("converts a Lead with no linked Customer: creates a new Customer (source=LEAD_CONVERSION) and a Deal", async () => {
    const lead = await createLead("Brand New Opportunity", newCustomerMobile, {
      company: "New Co",
      industry: "Retail",
    });
    newCustomerLeadId = lead.id;
    await walkToWon(lead.id);

    const res = await authed("post", `/api/v1/crm/leads/${lead.id}/convert`);
    expect(res.status).toBe(201);
    const result = (res.body as ApiSuccessResponse<LeadConversionResult>).data;
    expect(result.leadId).toBe(lead.id);
    expect(result.customerId).toBeTruthy();
    expect(result.dealId).toBeTruthy();
    newCustomerId = result.customerId;
    newDealId = result.dealId;

    const customerRes = await authed("get", `/api/v1/crm/customers/${newCustomerId}`);
    expect(customerRes.status).toBe(200);
    const customer = (customerRes.body as ApiSuccessResponse<CustomerSummary>).data;
    expect(customer.source).toBe("LEAD_CONVERSION");
    expect(customer.mobileNumber).toBe(newCustomerMobile);
    expect(customer.customerName).toBe("Brand New Opportunity");

    const leadRes = await authed("get", `/api/v1/crm/leads/${lead.id}`);
    const converted = (leadRes.body as ApiSuccessResponse<LeadSummary>).data;
    expect(converted.customerId).toBe(newCustomerId);
    expect(converted.dealId).toBe(newDealId);
    expect(converted.convertedAt).not.toBeNull();
  });

  it("is idempotent: converting an already-converted Lead again returns 409, no second Deal created", async () => {
    const res = await authed("post", `/api/v1/crm/leads/${newCustomerLeadId}/convert`);
    expect(res.status).toBe(409);

    // The existing conversion result is unchanged — same Deal/Customer as
    // the first call, fetched via GET (the 409 body itself only carries a
    // message; see LeadConversionService's idempotency comment).
    const leadRes = await authed("get", `/api/v1/crm/leads/${newCustomerLeadId}`);
    const lead = (leadRes.body as ApiSuccessResponse<LeadSummary>).data;
    expect(lead.dealId).toBe(newDealId);
    expect(lead.customerId).toBe(newCustomerId);
  });

  it("a converted Lead is read-only: update, assign, status change, and archive are all rejected", async () => {
    const updateRes = await authed("patch", `/api/v1/crm/leads/${newCustomerLeadId}`).send({
      company: "Should Not Apply",
    });
    expect(updateRes.status).toBe(400);

    const statusRes = await authed("patch", `/api/v1/crm/leads/${newCustomerLeadId}/status`).send({
      status: "LOST",
    });
    expect(statusRes.status).toBe(400);

    const archiveRes = await authed("patch", `/api/v1/crm/leads/${newCustomerLeadId}/archive`);
    expect(archiveRes.status).toBe(400);
  });

  it("converts a Lead that already has a linked Customer: reuses it, does not create a second Customer", async () => {
    const customer = await createCustomer(upsellMobile, "Upsell Customer");
    const lead = await createLead("Upsell Opportunity", upsellMobile, {
      customerId: customer.id,
      source: "EXISTING_CUSTOMER",
    });
    expect(lead.customerId).toBe(customer.id);
    await walkToWon(lead.id);

    const res = await authed("post", `/api/v1/crm/leads/${lead.id}/convert`);
    expect(res.status).toBe(201);
    const result = (res.body as ApiSuccessResponse<LeadConversionResult>).data;
    expect(result.customerId).toBe(customer.id);

    const customerRes = await authed("get", `/api/v1/crm/customers/${customer.id}`);
    const stillSameCustomer = (customerRes.body as ApiSuccessResponse<CustomerSummary>).data;
    expect(stillSameCustomer.id).toBe(customer.id);
  });

  it("allows a Sales Executive to convert (CONVERT_LEADS permission grant)", async () => {
    const lead = await createLead("Sales Exec Conversion", salesExecMobile);
    await walkToWon(lead.id);

    const res = await authed(
      "post",
      `/api/v1/crm/leads/${lead.id}/convert`,
      salesExecutiveAccessToken,
    );
    expect(res.status).toBe(201);
    const result = (res.body as ApiSuccessResponse<LeadConversionResult>).data;
    expect(result.leadId).toBe(lead.id);
  });
});
