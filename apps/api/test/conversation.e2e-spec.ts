import { createHmac } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import { Types } from "mongoose";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import type { AppConfig } from "../src/config/configuration.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair, UserProfile } from "../src/modules/identity/identity.types.js";
import type { WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import { PhoneNumberRepository } from "../src/modules/communication/repositories/phone-number.repository.js";
import { WhatsAppConnectionRepository } from "../src/modules/communication/repositories/whatsapp-connection.repository.js";
import { MessageRepository } from "../src/modules/communication/repositories/message.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import { ConversationStatus } from "../src/modules/communication/schemas/conversation.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type {
  ConversationNoteSummary,
  ConversationSummary,
  MessageSummary,
} from "../src/modules/communication/communication.types.js";

/**
 * Covers PRD-003 Part 2's core lifecycle end-to-end: inbound message ->
 * Conversation auto-created (NEW) -> agent reply reopens/promotes it ->
 * assign/unassign -> manual status transitions -> Internal Notes -> a
 * closed/resolved conversation reopening on new inbound activity.
 *
 * MetaApiClient is overridden (like EmailService already is elsewhere) so
 * the reply path never calls the live Graph API — same reasoning
 * communication.e2e-spec.ts already documents for the connect flow.
 */
describe("Conversation lifecycle (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let messageRepository: MessageRepository;
  let metaApiClient: { sendTextMessage: jest.Mock };

  const runId = Date.now();
  const ownerEmail = `conv-owner-${runId}@example.com`;
  const ownerMobile = `+9112${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-conv-${runId}`;
  const contactPhone = `+9123${String(runId).slice(-8)}`;
  const secondContactPhone = `+9124${String(runId).slice(-8)}`;

  let workspaceId: string;
  let ownerUserId: string;
  let ownerAccessToken: string;
  let appSecret: string;

  beforeAll(async () => {
    sentEmails = [];
    metaApiClient = { sendTextMessage: jest.fn() };

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
    messageRepository = moduleRef.get(MessageRepository);
    const tokenEncryption = moduleRef.get(TokenEncryptionService);
    const configService = moduleRef.get<ConfigService<AppConfig, true>>(ConfigService);
    appSecret = configService.get("meta", { infer: true }).appSecret;

    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Conv Owner",
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
      .send({ name: "Conv Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    tokens = createBody.data.tokens;
    ownerAccessToken = tokens.accessToken;

    const meRes = await request(app.getHttpServer() as Server)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    ownerUserId = (meRes.body as ApiSuccessResponse<UserProfile>).data.id;

    await phoneNumberRepository.upsert(
      workspaceId,
      new Types.ObjectId().toString(),
      metaPhoneNumberId,
      {
        displayPhoneNumber: "+91 90000 00001",
        verifiedName: "Conv Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-conv-${runId}`,
      businessName: "Conv Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: ownerUserId,
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

  function signedWebhookRequest(body: object): { json: string; signature: string } {
    const json = JSON.stringify(body);
    const signature = `sha256=${createHmac("sha256", appSecret).update(Buffer.from(json)).digest("hex")}`;
    return { json, signature };
  }

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("waitFor timed out");
  }

  async function sendInbound(
    waMessageId: string,
    text: string,
    from: string = contactPhone,
  ): Promise<void> {
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
                contacts: [{ profile: { name: "Conv Contact" }, wa_id: from.slice(1) }],
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
    const { json, signature } = signedWebhookRequest(payload);
    const response = await request(server())
      .post("/api/webhooks/whatsapp")
      .type("json")
      .set("X-Hub-Signature-256", signature)
      .send(json);
    expect(response.status).toBe(200);
    await waitFor(async () => (await messageRepository.findByWaMessageId(waMessageId)) !== null);
  }

  it("runs the full Conversation lifecycle", async () => {
    // 1. First inbound message auto-creates a NEW conversation.
    await sendInbound(`wamid.conv-in-1-${runId}`, "Hi, I need help");

    const listRes = await authed("get", "/api/v1/communication/conversations");
    const listBody = listRes.body as ApiSuccessResponse<ConversationSummary[]>;
    const conversation = listBody.data.find((c) => c.contactPhoneNumber === contactPhone);
    expect(conversation).toBeDefined();
    expect(conversation!.status).toBe(ConversationStatus.NEW);
    const conversationId = conversation!.id;

    // 2. Agent reply promotes NEW -> OPEN (nobody assigned yet).
    metaApiClient.sendTextMessage.mockResolvedValueOnce(`wamid.conv-out-1-${runId}`);
    const replyRes = await authed(
      "post",
      `/api/v1/communication/conversations/${conversationId}/messages`,
    ).send({ text: "Hi! How can I help?" });
    expect(replyRes.status).toBe(201);
    const replyBody = replyRes.body as ApiSuccessResponse<MessageSummary>;
    expect(replyBody.data.conversationId).toBe(conversationId);

    let getRes = await authed("get", `/api/v1/communication/conversations/${conversationId}`);
    expect((getRes.body as ApiSuccessResponse<ConversationSummary>).data.status).toBe(
      ConversationStatus.OPEN,
    );

    // 3. Assign to the Owner -> OPEN promotes to ASSIGNED.
    const assignRes = await authed(
      "patch",
      `/api/v1/communication/conversations/${conversationId}/assign`,
    ).send({ assignedToUserId: ownerUserId });
    expect(assignRes.status).toBe(200);
    expect((assignRes.body as ApiSuccessResponse<ConversationSummary>).data.status).toBe(
      ConversationStatus.ASSIGNED,
    );
    expect((assignRes.body as ApiSuccessResponse<ConversationSummary>).data.assignedToUserId).toBe(
      ownerUserId,
    );

    // 4. Add an Internal Note.
    const noteRes = await authed(
      "post",
      `/api/v1/communication/conversations/${conversationId}/notes`,
    ).send({ text: "Customer is a priority account" });
    expect(noteRes.status).toBe(201);
    const notesListRes = await authed(
      "get",
      `/api/v1/communication/conversations/${conversationId}/notes`,
    );
    const notes = (notesListRes.body as ApiSuccessResponse<ConversationNoteSummary[]>).data;
    expect(notes).toHaveLength(1);
    expect(notes[0]?.authorUserId).toBe(ownerUserId);

    // 5. Manually resolve, then close.
    const resolveRes = await authed(
      "patch",
      `/api/v1/communication/conversations/${conversationId}/status`,
    ).send({ status: ConversationStatus.RESOLVED });
    expect((resolveRes.body as ApiSuccessResponse<ConversationSummary>).data.status).toBe(
      ConversationStatus.RESOLVED,
    );
    expect(
      (resolveRes.body as ApiSuccessResponse<ConversationSummary>).data.resolvedAt,
    ).not.toBeNull();

    // Manual override to CLOSED (agent closes immediately, not via the
    // auto-close sweep) — a legal manual transition.
    const closeRes = await authed(
      "patch",
      `/api/v1/communication/conversations/${conversationId}/status`,
    ).send({ status: ConversationStatus.CLOSED });
    expect((closeRes.body as ApiSuccessResponse<ConversationSummary>).data.status).toBe(
      ConversationStatus.CLOSED,
    );

    // 6. A new inbound message reopens the CLOSED conversation — since it's
    // still assigned to the Owner, it reopens straight to ASSIGNED, not OPEN.
    await sendInbound(`wamid.conv-in-2-${runId}`, "Are you still there?");
    getRes = await authed("get", `/api/v1/communication/conversations/${conversationId}`);
    const reopened = (getRes.body as ApiSuccessResponse<ConversationSummary>).data;
    expect(reopened.status).toBe(ConversationStatus.ASSIGNED);
    expect(reopened.closedAt).toBeNull();

    // 7. Unassigning an ASSIGNED conversation demotes it back to OPEN.
    const unassignRes = await authed(
      "patch",
      `/api/v1/communication/conversations/${conversationId}/assign`,
    ).send({ assignedToUserId: null });
    expect((unassignRes.body as ApiSuccessResponse<ConversationSummary>).data.status).toBe(
      ConversationStatus.OPEN,
    );

    // 8. Message history for the conversation includes every message sent so far.
    const messagesRes = await authed(
      "get",
      `/api/v1/communication/conversations/${conversationId}/messages`,
    );
    const messages = (messagesRes.body as ApiSuccessResponse<MessageSummary[]>).data;
    expect(messages.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects assigning to a user who isn't a member of the workspace, and rejects manually setting NEW", async () => {
    await sendInbound(`wamid.conv-in-guard-${runId}`, "Second contact message", secondContactPhone);
    const listRes = await authed("get", "/api/v1/communication/conversations?status=NEW");
    const conversation = (listRes.body as ApiSuccessResponse<ConversationSummary[]>).data.find(
      (c) => c.contactPhoneNumber === secondContactPhone,
    );
    expect(conversation).toBeDefined();

    const statusRes = await authed(
      "patch",
      `/api/v1/communication/conversations/${conversation!.id}/status`,
    ).send({ status: ConversationStatus.NEW });
    expect(statusRes.status).toBe(400);

    const assignRes = await authed(
      "patch",
      `/api/v1/communication/conversations/${conversation!.id}/assign`,
    ).send({ assignedToUserId: new Types.ObjectId().toString() });
    expect(assignRes.status).toBe(400);
  });
});
