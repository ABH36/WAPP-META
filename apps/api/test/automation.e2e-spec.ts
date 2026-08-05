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
import type {
  AutomationSettingsSummary,
  ConversationSummary,
  MessageSummary,
} from "../src/modules/communication/communication.types.js";

/**
 * Covers Phase-4 Part 4a end-to-end: Welcome message on a brand-new
 * Contact's first message, and Away message on a returning Contact's
 * message once business hours are configured "always closed". MetaApiClient
 * is fully overridden (same reasoning as the other Communication e2e specs)
 * so this never calls the live Graph API.
 */
describe("Automation Engine - Business Hours + Welcome/Away (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let metaApiClient: { sendTextMessage: jest.Mock; sendTemplateMessage: jest.Mock };

  const runId = Date.now();
  const ownerEmail = `automation-owner-${runId}@example.com`;
  const ownerMobile = `+9116${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-automation-${runId}`;
  const welcomeContactPhone = `+9128${String(runId).slice(-7)}1`;
  const awayContactPhone = `+9128${String(runId).slice(-7)}2`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let appSecret: string;

  beforeAll(async () => {
    sentEmails = [];
    let sendCounter = 0;
    metaApiClient = {
      sendTextMessage: jest.fn(() => Promise.resolve(`wamid.automation-${runId}-${++sendCounter}`)),
      sendTemplateMessage: jest.fn(),
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
    const configService = moduleRef.get<ConfigService<AppConfig, true>>(ConfigService);
    appSecret = configService.get("meta", { infer: true }).appSecret;

    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Automation Owner",
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
      .send({ name: "Automation Test Co" });
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
        displayPhoneNumber: "+91 90000 00005",
        verifiedName: "Automation Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-automation-${runId}`,
      businessName: "Automation Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    // "Always closed" — no schedule entries at all. Welcome doesn't consult
    // business hours (see docs/COMM-AUTOMATION-BUSINESS-HOURS.md), so this
    // setting is only exercised by the Away test below.
    await authed("patch", "/api/v1/workspaces/me/business-hours").send({
      timezone: "UTC",
      schedule: [],
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

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("waitFor timed out");
  }

  async function sendInbound(waMessageId: string, text: string, from: string): Promise<void> {
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
                contacts: [{ profile: { name: "Automation Contact" }, wa_id: from.slice(1) }],
                messages: [
                  {
                    from: from.slice(1),
                    id: waMessageId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: text },
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

  async function findConversationByPhone(phone: string): Promise<ConversationSummary> {
    const res = await authed("get", "/api/v1/communication/conversations");
    const conversations = (res.body as ApiSuccessResponse<ConversationSummary[]>).data;
    const found = conversations.find((c) => c.contactPhoneNumber === phone);
    if (!found) throw new Error(`No conversation found for ${phone}`);
    return found;
  }

  it("configures Welcome/Away settings via the automation-settings endpoint", async () => {
    const getRes = await authed("get", "/api/v1/communication/automation-settings");
    expect((getRes.body as ApiSuccessResponse<AutomationSettingsSummary>).data).toEqual({
      welcomeMessageEnabled: false,
      welcomeMessageText: null,
      awayMessageEnabled: false,
      awayMessageText: null,
      updatedAt: null,
    });

    const patchRes = await authed("patch", "/api/v1/communication/automation-settings").send({
      welcomeMessageEnabled: true,
      welcomeMessageText: "Welcome! We usually reply within a few hours.",
      awayMessageEnabled: true,
      awayMessageText: "We're currently closed — we'll get back to you soon.",
    });
    const updated = (patchRes.body as ApiSuccessResponse<AutomationSettingsSummary>).data;
    expect(updated.welcomeMessageEnabled).toBe(true);
    expect(updated.awayMessageEnabled).toBe(true);
    expect(updated.updatedAt).not.toBeNull();
  });

  it("sends the Welcome message on a brand-new Contact's first message", async () => {
    await sendInbound(`wamid.welcome-${runId}`, "Hi, is anyone there?", welcomeContactPhone);

    await waitFor(async () => {
      try {
        const conversation = await findConversationByPhone(welcomeContactPhone);
        const messagesRes = await authed(
          "get",
          `/api/v1/communication/conversations/${conversation.id}/messages`,
        );
        const messages = (messagesRes.body as ApiSuccessResponse<MessageSummary[]>).data;
        return messages.length >= 2;
      } catch {
        return false;
      }
    });

    const conversation = await findConversationByPhone(welcomeContactPhone);
    const messagesRes = await authed(
      "get",
      `/api/v1/communication/conversations/${conversation.id}/messages`,
    );
    const messages = (messagesRes.body as ApiSuccessResponse<MessageSummary[]>).data;
    const welcomeReply = messages.find(
      (m) => m.text === "Welcome! We usually reply within a few hours.",
    );
    expect(welcomeReply).toBeDefined();
    expect(welcomeReply?.direction).toBe("OUTBOUND");
  });

  it("sends the Away message to a returning Contact once the conversation is no longer NEW", async () => {
    await sendInbound(`wamid.away-in-1-${runId}`, "Hello?", awayContactPhone);

    let conversation: ConversationSummary | undefined;
    await waitFor(async () => {
      try {
        conversation = await findConversationByPhone(awayContactPhone);
        return true;
      } catch {
        return false;
      }
    });

    // Agent reply moves the conversation off NEW (see
    // conversation-state-machine.ts) — this is what actually unlocks the
    // Away branch, which never fires on a still-NEW conversation.
    await authed("post", `/api/v1/communication/conversations/${conversation!.id}/messages`).send({
      text: "Hey! What can I help with?",
    });

    await sendInbound(`wamid.away-in-2-${runId}`, "Just checking in", awayContactPhone);

    await waitFor(async () => {
      const messagesRes = await authed(
        "get",
        `/api/v1/communication/conversations/${conversation!.id}/messages`,
      );
      const messages = (messagesRes.body as ApiSuccessResponse<MessageSummary[]>).data;
      return messages.some(
        (m) => m.text === "We're currently closed — we'll get back to you soon.",
      );
    });
  });
});
