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
import { ContactRepository } from "../src/modules/communication/repositories/contact.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import { TemplateCategory } from "../src/modules/communication/schemas/template.schema.js";
import { BroadcastStatus } from "../src/modules/communication/schemas/broadcast.schema.js";
import { CampaignStatus } from "../src/modules/communication/schemas/campaign.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type {
  BroadcastSummary,
  CampaignStatsSummary,
  CampaignSummary,
  TemplateSummary,
} from "../src/modules/communication/communication.types.js";

/**
 * Covers Phase-4 Part 3b-ii end-to-end: a 2-wave Campaign runs both waves
 * to completion and the Campaign itself auto-completes via the
 * BROADCAST_FINISHED event listener, plus the cancel cascade. MetaApiClient
 * is fully overridden (same reasoning as broadcast.e2e-spec.ts) so this
 * never calls the live Graph API.
 */
describe("Campaign lifecycle (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let contactRepository: ContactRepository;
  let metaApiClient: {
    createTemplate: jest.Mock;
    listTemplates: jest.Mock;
    sendTemplateMessage: jest.Mock;
    sendTextMessage: jest.Mock;
  };

  const runId = Date.now();
  const ownerEmail = `campaign-owner-${runId}@example.com`;
  const ownerMobile = `+9115${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-campaign-${runId}`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let phoneNumberDbId: string;
  let approvedTemplateId: string;
  let contactIds: string[];

  beforeAll(async () => {
    sentEmails = [];
    let sendCounter = 0;
    metaApiClient = {
      createTemplate: jest.fn(),
      listTemplates: jest.fn(),
      sendTemplateMessage: jest.fn(() =>
        Promise.resolve(`wamid.campaign-${runId}-${++sendCounter}`),
      ),
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
    contactRepository = moduleRef.get(ContactRepository);
    const tokenEncryption = moduleRef.get(TokenEncryptionService);

    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Campaign Owner",
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
      .send({ name: "Campaign Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    tokens = createBody.data.tokens;
    ownerAccessToken = tokens.accessToken;

    const phoneNumber = await phoneNumberRepository.upsert(
      workspaceId,
      new Types.ObjectId().toString(),
      metaPhoneNumberId,
      {
        displayPhoneNumber: "+91 90000 00004",
        verifiedName: "Campaign Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    phoneNumberDbId = phoneNumber._id.toString();

    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-campaign-${runId}`,
      businessName: "Campaign Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    const contacts = await Promise.all(
      [1, 2].map((n) =>
        contactRepository.findOrCreate(workspaceId, `+9127${String(runId).slice(-7)}${n}`, null),
      ),
    );
    contactIds = contacts.map((c) => c._id.toString());

    const templateRes = await authed("post", "/api/v1/communication/templates").send({
      name: "diwali_sale",
      category: TemplateCategory.MARKETING,
      language: "en_US",
      components: [{ type: "BODY", text: "Diwali sale is live!" }],
    });
    approvedTemplateId = (templateRes.body as ApiSuccessResponse<TemplateSummary>).data.id;

    metaApiClient.createTemplate.mockResolvedValueOnce({
      metaTemplateId: `meta-tpl-campaign-${runId}`,
      status: "PENDING",
    });
    await authed("post", `/api/v1/communication/templates/${approvedTemplateId}/submit`);

    metaApiClient.listTemplates.mockResolvedValueOnce([
      {
        metaTemplateId: `meta-tpl-campaign-${runId}`,
        name: "diwali_sale",
        status: "APPROVED",
        category: TemplateCategory.MARKETING,
        language: "en_US",
        components: [{ type: "BODY", text: "Diwali sale is live!" }],
        rejectedReason: null,
      },
    ]);
    await authed("post", "/api/v1/communication/templates/sync");
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

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("waitFor timed out");
  }

  it("runs every wave to completion and auto-completes the Campaign via the BROADCAST_FINISHED listener", async () => {
    const wave1ScheduledAt = new Date(Date.now() + 200);
    const wave2ScheduledAt = new Date(Date.now() + 600);

    const createRes = await authed("post", "/api/v1/communication/campaigns").send({
      name: "Diwali Campaign",
      phoneNumberId: phoneNumberDbId,
      targetContactIds: contactIds,
      waves: [
        {
          name: "Announcement",
          templateId: approvedTemplateId,
          bodyParameters: [],
          scheduledAt: wave1ScheduledAt.toISOString(),
        },
        {
          name: "Reminder",
          templateId: approvedTemplateId,
          bodyParameters: [],
          scheduledAt: wave2ScheduledAt.toISOString(),
        },
      ],
    });
    expect(createRes.status).toBe(201);
    const campaign = (createRes.body as ApiSuccessResponse<CampaignSummary>).data;
    expect(campaign.status).toBe(CampaignStatus.ACTIVE);

    const wavesRes = await authed("get", `/api/v1/communication/campaigns/${campaign.id}/waves`);
    const waves = (wavesRes.body as ApiSuccessResponse<BroadcastSummary[]>).data;
    expect(waves).toHaveLength(2);
    expect(waves.every((w) => w.campaignId === campaign.id)).toBe(true);
    expect(waves.every((w) => w.status === BroadcastStatus.SCHEDULED)).toBe(true);

    await waitFor(async () => {
      const res = await authed("get", `/api/v1/communication/campaigns/${campaign.id}`);
      return (
        (res.body as ApiSuccessResponse<CampaignSummary>).data.status === CampaignStatus.COMPLETED
      );
    });

    const finalWavesRes = await authed(
      "get",
      `/api/v1/communication/campaigns/${campaign.id}/waves`,
    );
    const finalWaves = (finalWavesRes.body as ApiSuccessResponse<BroadcastSummary[]>).data;
    expect(finalWaves.every((w) => w.status === BroadcastStatus.COMPLETED)).toBe(true);

    const statsRes = await authed("get", `/api/v1/communication/campaigns/${campaign.id}/stats`);
    const stats = (statsRes.body as ApiSuccessResponse<CampaignStatsSummary>).data;
    expect(stats).toEqual({ waveCount: 2, pending: 0, sent: 4, failed: 0, total: 4 });
  });

  it("cancels a Campaign and cascades to cancel its still-active waves", async () => {
    const farFutureScheduledAt = new Date(Date.now() + 60 * 60 * 1000);

    const createRes = await authed("post", "/api/v1/communication/campaigns").send({
      name: "Future Campaign",
      phoneNumberId: phoneNumberDbId,
      targetContactIds: contactIds,
      waves: [
        {
          name: "Far future wave",
          templateId: approvedTemplateId,
          bodyParameters: [],
          scheduledAt: farFutureScheduledAt.toISOString(),
        },
      ],
    });
    const campaign = (createRes.body as ApiSuccessResponse<CampaignSummary>).data;

    const cancelRes = await authed(
      "patch",
      `/api/v1/communication/campaigns/${campaign.id}/cancel`,
    );
    expect((cancelRes.body as ApiSuccessResponse<CampaignSummary>).data.status).toBe(
      CampaignStatus.CANCELLED,
    );

    const secondCancelRes = await authed(
      "patch",
      `/api/v1/communication/campaigns/${campaign.id}/cancel`,
    );
    expect(secondCancelRes.status).toBe(400);

    const wavesRes = await authed("get", `/api/v1/communication/campaigns/${campaign.id}/waves`);
    const waves = (wavesRes.body as ApiSuccessResponse<BroadcastSummary[]>).data;
    expect(waves).toHaveLength(1);
    expect(waves[0]?.status).toBe(BroadcastStatus.CANCELLED);
  });
});
