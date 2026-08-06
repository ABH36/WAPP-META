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
import type { WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import { PhoneNumberRepository } from "../src/modules/communication/repositories/phone-number.repository.js";
import { WhatsAppConnectionRepository } from "../src/modules/communication/repositories/whatsapp-connection.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type { AppConfig } from "../src/config/configuration.js";
import type { CustomerSummary } from "../src/modules/crm/crm.types.js";

/**
 * Covers Phase-5 Part-1 (PRD-004 Volume-1, Customer Management) end-to-end
 * against real Docker Mongo/Redis: Method 1 (Manual Creation) resolving/
 * creating a Contact, Method 3 (Convert Existing Contact) against a Contact
 * that genuinely originated from an inbound WhatsApp message, duplicate
 * prevention, and the full ACTIVE/BLOCKED/ARCHIVED lifecycle.
 */
describe("Customer Management (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let appSecret: string;

  const runId = Date.now();
  const ownerEmail = `crm-owner-${runId}@example.com`;
  const ownerMobile = `+9118${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-crm-${runId}`;
  const manualMobile = `+9130${String(runId).slice(-7)}1`;
  const whatsappContactMobile = `+9130${String(runId).slice(-7)}2`;

  let workspaceId: string;
  let ownerAccessToken: string;

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
      fullName: "CRM Owner",
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
      .send({ name: "CRM Test Co" });
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
        displayPhoneNumber: "+91 90000 00007",
        verifiedName: "CRM Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-crm-${runId}`,
      businessName: "CRM Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });
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

  function extractLink(to: string): string {
    const job = sentEmails.find(
      (email) => email.to === to && email.category === "email-verification",
    );
    const link = job?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) {
      throw new Error(`No email-verification email found for ${to}`);
    }
    return link;
  }

  /** Creates a real, Communication-owned Contact via a signed inbound webhook — the only way a Contact exists today (ADR-COMM-002). */
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
                    id: `wamid.crm-${runId}-${from}`,
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

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("waitFor timed out");
  }

  async function findContactIdByPhone(phone: string): Promise<string> {
    // Conversations list surfaces contactPhoneNumber — reused here purely as
    // a way to discover the Contact id a webhook message just created,
    // without CRM needing its own read access to Communication internals.
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

  let manualCustomerId: string;

  it("Method 1 (Manual Creation): resolves/creates the Contact and sources MANUAL_ENTRY", async () => {
    const res = await authed("post", "/api/v1/crm/customers").send({
      customerName: "Acme Retail",
      mobileNumber: manualMobile,
      companyName: "Acme Pvt Ltd",
      email: "acme@example.com",
    });

    expect(res.status).toBe(201);
    const customer = (res.body as ApiSuccessResponse<CustomerSummary>).data;
    expect(customer.mobileNumber).toBe(manualMobile);
    expect(customer.source).toBe("MANUAL_ENTRY");
    expect(customer.status).toBe("ACTIVE");
    expect(customer.companyName).toBe("Acme Pvt Ltd");
    manualCustomerId = customer.id;
  });

  it("rejects a duplicate Customer for the same mobile number in the workspace", async () => {
    const res = await authed("post", "/api/v1/crm/customers").send({
      customerName: "Acme Retail Duplicate",
      mobileNumber: manualMobile,
    });

    expect(res.status).toBe(409);
  });

  it("Method 3 (Convert Existing Contact): sources WHATSAPP from a real inbound-message Contact", async () => {
    await createContactViaWhatsApp(whatsappContactMobile);
    let contactId = "";
    await waitFor(async () => {
      try {
        contactId = await findContactIdByPhone(whatsappContactMobile);
        return true;
      } catch {
        return false;
      }
    });

    const res = await authed("post", "/api/v1/crm/customers").send({
      customerName: "WhatsApp Lead",
      contactId,
    });

    expect(res.status).toBe(201);
    const customer = (res.body as ApiSuccessResponse<CustomerSummary>).data;
    expect(customer.mobileNumber).toBe(whatsappContactMobile);
    expect(customer.source).toBe("WHATSAPP");
    expect(customer.contactId).toBe(contactId);
  });

  it("gets a Customer by id", async () => {
    const res = await authed("get", `/api/v1/crm/customers/${manualCustomerId}`);
    expect(res.status).toBe(200);
    expect((res.body as ApiSuccessResponse<CustomerSummary>).data.customerName).toBe("Acme Retail");
  });

  it("lists Customers filtered by status and searches by name", async () => {
    const listRes = await authed("get", "/api/v1/crm/customers?status=ACTIVE");
    const listed = (listRes.body as ApiSuccessResponse<CustomerSummary[]>).data;
    expect(listed.some((c) => c.id === manualCustomerId)).toBe(true);

    const searchRes = await authed("get", "/api/v1/crm/customers/search?q=Acme");
    const searched = (searchRes.body as ApiSuccessResponse<CustomerSummary[]>).data;
    expect(searched.some((c) => c.id === manualCustomerId)).toBe(true);
  });

  it("updates business-profile fields via the general update endpoint", async () => {
    const res = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}`).send({
      companyName: "Acme Inc",
      industry: "Retail",
    });

    expect(res.status).toBe(200);
    const updated = (res.body as ApiSuccessResponse<CustomerSummary>).data;
    expect(updated.companyName).toBe("Acme Inc");
    expect(updated.industry).toBe("Retail");
    expect(updated.mobileNumber).toBe(manualMobile);
  });

  it("rejects an update attempt that includes the immutable mobileNumber field", async () => {
    // UpdateCustomerDto doesn't declare mobileNumber at all — combined with
    // the global ValidationPipe's forbidNonWhitelisted:true, sending it
    // rejects the whole request rather than silently stripping it.
    const res = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}`).send({
      mobileNumber: "+911111111111",
    });

    expect(res.status).toBe(400);
  });

  it("runs the full ACTIVE -> BLOCKED -> ACTIVE -> ARCHIVED lifecycle", async () => {
    const blockRes = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}/block`);
    expect(blockRes.status).toBe(200);
    expect((blockRes.body as ApiSuccessResponse<CustomerSummary>).data.status).toBe("BLOCKED");

    const blockAgainRes = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}/block`);
    expect(blockAgainRes.status).toBe(400);

    const activateRes = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}/activate`);
    expect(activateRes.status).toBe(200);
    expect((activateRes.body as ApiSuccessResponse<CustomerSummary>).data.status).toBe("ACTIVE");

    const archiveRes = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect((archiveRes.body as ApiSuccessResponse<CustomerSummary>).data.status).toBe("ARCHIVED");

    // ARCHIVED is terminal.
    const archiveAgainRes = await authed(
      "patch",
      `/api/v1/crm/customers/${manualCustomerId}/archive`,
    );
    expect(archiveAgainRes.status).toBe(400);

    // Customer Editing Policy (ADR-CRM-004) — ARCHIVED is read-only for the
    // general update endpoint.
    const editArchivedRes = await authed("patch", `/api/v1/crm/customers/${manualCustomerId}`).send(
      { companyName: "Should Not Apply" },
    );
    expect(editArchivedRes.status).toBe(400);

    // BR-005 — archived Customers remain searchable.
    const searchRes = await authed("get", "/api/v1/crm/customers/search?q=Acme");
    const searched = (searchRes.body as ApiSuccessResponse<CustomerSummary[]>).data;
    expect(searched.some((c) => c.id === manualCustomerId)).toBe(true);
  });
});
