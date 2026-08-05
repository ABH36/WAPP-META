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
import { BroadcastRecipientStatus } from "../src/modules/communication/schemas/broadcast-recipient.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type {
  BroadcastRecipientSummary,
  BroadcastSummary,
  TemplateSummary,
} from "../src/modules/communication/communication.types.js";
import type { BroadcastRecipientStats } from "../src/modules/communication/repositories/broadcast-recipient.repository.js";

/**
 * Covers Phase-4 Part 3b-i end-to-end: create -> send -> sequential fan-out
 * -> COMPLETED, plus the DRAFT/CANCELLED guard rails. MetaApiClient is fully
 * overridden (same reasoning as template.e2e-spec.ts) so this never calls
 * the live Graph API.
 */
describe("Broadcast lifecycle (e2e)", () => {
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
  const ownerEmail = `bcast-owner-${runId}@example.com`;
  const ownerMobile = `+9114${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-bcast-${runId}`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let phoneNumberDbId: string;
  let approvedTemplateId: string;
  let contactIds: string[];

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
    contactRepository = moduleRef.get(ContactRepository);
    const tokenEncryption = moduleRef.get(TokenEncryptionService);

    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Broadcast Owner",
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
      .send({ name: "Broadcast Test Co" });
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
        displayPhoneNumber: "+91 90000 00003",
        verifiedName: "Broadcast Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    phoneNumberDbId = phoneNumber._id.toString();

    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-bcast-${runId}`,
      businessName: "Broadcast Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    // Three known Contacts to target — seeded directly (not via a real
    // inbound webhook) since only their identity, not any conversation
    // history, matters for this suite.
    const contacts = await Promise.all(
      [1, 2, 3].map((n) =>
        contactRepository.findOrCreate(workspaceId, `+9126${String(runId).slice(-7)}${n}`, null),
      ),
    );
    contactIds = contacts.map((c) => c._id.toString());

    // Create + submit + sync a template through to APPROVED — same flow
    // template.e2e-spec.ts already verifies end-to-end.
    const templateRes = await authedRequest(
      app,
      ownerAccessToken,
      "post",
      "/api/v1/communication/templates",
    ).send({
      name: "sale_announcement",
      category: TemplateCategory.MARKETING,
      language: "en_US",
      components: [{ type: "BODY", text: "Big sale this weekend!" }],
    });
    approvedTemplateId = (templateRes.body as ApiSuccessResponse<TemplateSummary>).data.id;

    metaApiClient.createTemplate.mockResolvedValueOnce({
      metaTemplateId: `meta-tpl-bcast-${runId}`,
      status: "PENDING",
    });
    await authedRequest(
      app,
      ownerAccessToken,
      "post",
      `/api/v1/communication/templates/${approvedTemplateId}/submit`,
    );

    metaApiClient.listTemplates.mockResolvedValueOnce([
      {
        metaTemplateId: `meta-tpl-bcast-${runId}`,
        name: "sale_announcement",
        status: "APPROVED",
        category: TemplateCategory.MARKETING,
        language: "en_US",
        components: [{ type: "BODY", text: "Big sale this weekend!" }],
        rejectedReason: null,
      },
    ]);
    await authedRequest(app, ownerAccessToken, "post", "/api/v1/communication/templates/sync");
  });

  afterAll(async () => {
    await app.close();
  });

  function authed(method: "get" | "post" | "patch", path: string) {
    return authedRequest(app, ownerAccessToken, method, path);
  }

  function authedRequest(
    nestApp: INestApplication,
    accessToken: string,
    method: "get" | "post" | "patch",
    path: string,
  ) {
    return request(nestApp.getHttpServer() as Server)
      [method](path)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("waitFor timed out");
  }

  it("runs a Broadcast to completion and reports accurate per-recipient stats", async () => {
    // Message.waMessageId is uniquely indexed — each of the 3 fan-out sends
    // needs its own id, or the 2nd/3rd would fail with a duplicate-key error.
    let sendCounter = 0;
    metaApiClient.sendTemplateMessage.mockImplementation(() =>
      Promise.resolve(`wamid.bcast-${runId}-${++sendCounter}`),
    );

    const createRes = await authed("post", "/api/v1/communication/broadcasts").send({
      name: "Weekend Sale",
      templateId: approvedTemplateId,
      phoneNumberId: phoneNumberDbId,
      targetContactIds: [...contactIds, contactIds[0]], // duplicate — must be deduped
      bodyParameters: [],
    });
    expect(createRes.status).toBe(201);
    const broadcast = (createRes.body as ApiSuccessResponse<BroadcastSummary>).data;
    expect(broadcast.status).toBe(BroadcastStatus.DRAFT);

    const sendRes = await authed("post", `/api/v1/communication/broadcasts/${broadcast.id}/send`);
    expect(sendRes.status).toBe(201);
    expect((sendRes.body as ApiSuccessResponse<BroadcastSummary>).data.status).toBe(
      BroadcastStatus.RUNNING,
    );

    await waitFor(async () => {
      const res = await authed("get", `/api/v1/communication/broadcasts/${broadcast.id}`);
      return (
        (res.body as ApiSuccessResponse<BroadcastSummary>).data.status === BroadcastStatus.COMPLETED
      );
    });

    const statsRes = await authed("get", `/api/v1/communication/broadcasts/${broadcast.id}/stats`);
    const stats = (statsRes.body as ApiSuccessResponse<BroadcastRecipientStats>).data;
    expect(stats).toEqual({ pending: 0, sent: 3, failed: 0, total: 3 });

    const recipientsRes = await authed(
      "get",
      `/api/v1/communication/broadcasts/${broadcast.id}/recipients`,
    );
    const recipients = (recipientsRes.body as ApiSuccessResponse<BroadcastRecipientSummary[]>).data;
    expect(recipients).toHaveLength(3);
    expect(
      recipients.every((r) => r.status === BroadcastRecipientStatus.SENT && r.messageId !== null),
    ).toBe(true);

    expect(metaApiClient.sendTemplateMessage).toHaveBeenCalledTimes(3);
  });

  it("rejects sending a broadcast targeting a Contact outside the workspace", async () => {
    const res = await authed("post", "/api/v1/communication/broadcasts").send({
      name: "Bad target",
      templateId: approvedTemplateId,
      phoneNumberId: phoneNumberDbId,
      targetContactIds: [new Types.ObjectId().toString()],
      bodyParameters: [],
    });
    expect(res.status).toBe(400);
  });

  it("cancels a DRAFT broadcast without ever sending anything", async () => {
    const createRes = await authed("post", "/api/v1/communication/broadcasts").send({
      name: "Never sent",
      templateId: approvedTemplateId,
      phoneNumberId: phoneNumberDbId,
      targetContactIds: [contactIds[0]],
      bodyParameters: [],
    });
    const broadcast = (createRes.body as ApiSuccessResponse<BroadcastSummary>).data;

    // A DRAFT (never RUNNING/SCHEDULED) can't be paused.
    const pauseRes = await authed(
      "patch",
      `/api/v1/communication/broadcasts/${broadcast.id}/pause`,
    );
    expect(pauseRes.status).toBe(400);

    const cancelRes = await authed(
      "patch",
      `/api/v1/communication/broadcasts/${broadcast.id}/cancel`,
    );
    expect((cancelRes.body as ApiSuccessResponse<BroadcastSummary>).data.status).toBe(
      BroadcastStatus.CANCELLED,
    );

    // Cancelling again is rejected — already terminal.
    const secondCancelRes = await authed(
      "patch",
      `/api/v1/communication/broadcasts/${broadcast.id}/cancel`,
    );
    expect(secondCancelRes.status).toBe(400);
  });
});
