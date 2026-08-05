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
import {
  TemplateCategory,
  TemplateStatus,
} from "../src/modules/communication/schemas/template.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type {
  MessageSummary,
  TemplateSummary,
} from "../src/modules/communication/communication.types.js";

/**
 * Covers Phase-4 Part 3a end-to-end: Template lifecycle (create -> submit ->
 * sync-to-APPROVED) and the Meta Compliance Engine's core guarantee — a
 * template message can reach a brand-new contact (no prior inbound message,
 * no Conversation window open at all), but a free-text message to that same
 * contact is still rejected, because sending a template doesn't itself open
 * the 24h customer-service window (only the *customer's own* reply does).
 *
 * MetaApiClient is fully overridden (same reasoning as conversation.e2e-spec.ts)
 * so this never calls the live Graph API.
 */
describe("Template lifecycle & Compliance Engine (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let metaApiClient: {
    createTemplate: jest.Mock;
    listTemplates: jest.Mock;
    sendTemplateMessage: jest.Mock;
    sendTextMessage: jest.Mock;
  };

  const runId = Date.now();
  const ownerEmail = `tpl-owner-${runId}@example.com`;
  const ownerMobile = `+9113${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-tpl-${runId}`;
  const newContactPhone = `+9125${String(runId).slice(-8)}`;

  let workspaceId: string;
  let ownerAccessToken: string;

  beforeAll(async () => {
    sentEmails = [];
    metaApiClient = {
      createTemplate: jest.fn(),
      listTemplates: jest.fn(),
      sendTemplateMessage: jest.fn(),
      sendTextMessage: jest.fn(),
    };

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

    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Template Owner",
        email: ownerEmail,
        mobileNumber: ownerMobile,
        password,
      });
    const link = sentEmails.find((e) => e.to === ownerEmail)?.html.match(/href="([^"]+)"/)?.[1];
    const token = new URL(link ?? "").searchParams.get("token") ?? "";
    const verifyRes = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/verify-email")
      .send({ token });
    let tokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data.tokens;

    const createRes = await request(app.getHttpServer() as Server)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ name: "Template Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    tokens = createBody.data.tokens;
    ownerAccessToken = tokens.accessToken;

    await phoneNumberRepository.upsert(
      workspaceId,
      new Types.ObjectId().toString(),
      metaPhoneNumberId,
      {
        displayPhoneNumber: "+91 90000 00002",
        verifiedName: "Template Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-tpl-${runId}`,
      businessName: "Template Test Co",
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

  it("runs the full Template lifecycle and enforces the compliance window separately from template delivery", async () => {
    // 1. Create a DRAFT template — rejected without a BODY component.
    const badRes = await authed("post", "/api/v1/communication/templates").send({
      name: "order_update",
      category: TemplateCategory.UTILITY,
      language: "en_US",
      components: [{ type: "HEADER", format: "TEXT", text: "Update" }],
    });
    expect(badRes.status).toBe(400);

    const createRes = await authed("post", "/api/v1/communication/templates").send({
      name: "order_update",
      category: TemplateCategory.UTILITY,
      language: "en_US",
      components: [{ type: "BODY", text: "Hi {{1}}, your order {{2}} has shipped." }],
    });
    expect(createRes.status).toBe(201);
    const template = (createRes.body as ApiSuccessResponse<TemplateSummary>).data;
    expect(template.status).toBe(TemplateStatus.DRAFT);

    // 2. Submit — Meta accepts it as PENDING.
    metaApiClient.createTemplate.mockResolvedValueOnce({
      metaTemplateId: `meta-tpl-${runId}`,
      status: "PENDING",
    });
    const submitRes = await authed("post", `/api/v1/communication/templates/${template.id}/submit`);
    expect(submitRes.status).toBe(201);
    expect((submitRes.body as ApiSuccessResponse<TemplateSummary>).data.status).toBe(
      TemplateStatus.PENDING,
    );

    // Submitting again is rejected — no longer DRAFT.
    const resubmitRes = await authed(
      "post",
      `/api/v1/communication/templates/${template.id}/submit`,
    );
    expect(resubmitRes.status).toBe(400);

    // 3. Sync from Meta — now APPROVED.
    metaApiClient.listTemplates.mockResolvedValueOnce([
      {
        metaTemplateId: `meta-tpl-${runId}`,
        name: "order_update",
        status: "APPROVED",
        category: TemplateCategory.UTILITY,
        language: "en_US",
        components: [{ type: "BODY", text: "Hi {{1}}, your order {{2}} has shipped." }],
        rejectedReason: null,
      },
    ]);
    const syncRes = await authed("post", "/api/v1/communication/templates/sync");
    expect(syncRes.status).toBe(201);
    const synced = (syncRes.body as ApiSuccessResponse<TemplateSummary[]>).data;
    const approvedTemplate = synced.find((t) => t.id === template.id);
    expect(approvedTemplate?.status).toBe(TemplateStatus.APPROVED);

    // 4. A template message reaches a brand-new contact who has never
    // messaged in — proves templates are exempt from the compliance window.
    metaApiClient.sendTemplateMessage.mockResolvedValueOnce(`wamid.tpl-${runId}`);
    const sendTemplateRes = await authed(
      "post",
      `/api/v1/communication/phone-numbers/${await phoneNumberDbId()}/template-messages`,
    ).send({
      to: newContactPhone,
      templateId: template.id,
      bodyParameters: ["Priya", "ORD-1001"],
    });
    expect(sendTemplateRes.status).toBe(201);
    const templateMessage = (sendTemplateRes.body as ApiSuccessResponse<MessageSummary>).data;
    expect(templateMessage.type).toBe("TEMPLATE");
    expect(templateMessage.text).toBe("Hi Priya, your order ORD-1001 has shipped.");

    // 5. A free-text message to that same contact is still rejected — the
    // template reached them, but the customer never replied, so the 24h
    // customer-service window has never actually opened.
    const freeTextRes = await authed(
      "post",
      `/api/v1/communication/phone-numbers/${await phoneNumberDbId()}/messages`,
    ).send({ to: newContactPhone, text: "Following up on your order" });
    expect(freeTextRes.status).toBe(403);
    expect(metaApiClient.sendTextMessage).not.toHaveBeenCalled();
  });

  async function phoneNumberDbId(): Promise<string> {
    const [phoneNumber] = await phoneNumberRepository.findByWorkspace(workspaceId);
    return phoneNumber!._id.toString();
  }
});
