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
import type { ConversationSummary } from "../src/modules/communication/communication.types.js";

/**
 * Covers Phase-4 Part 4b end-to-end: Round Robin and Least Active Agent
 * auto-assignment for brand-new inbound Conversations, against two real
 * SALES_EXECUTIVE team members (invited/accepted through the real Team
 * flow, same as workspace.e2e-spec.ts). MetaApiClient is fully overridden
 * so this never calls the live Graph API.
 */
describe("Auto Assignment - Round Robin + Least Active Agent (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;
  let metaApiClient: { sendTextMessage: jest.Mock; sendTemplateMessage: jest.Mock };

  const runId = Date.now();
  const ownerEmail = `assign-owner-${runId}@example.com`;
  const ownerMobile = `+9117${String(runId).slice(-8)}`;
  const agentAEmail = `assign-agent-a-${runId}@example.com`;
  const agentAMobile = `+9127${String(runId).slice(-8)}`;
  const agentBEmail = `assign-agent-b-${runId}@example.com`;
  const agentBMobile = `+9137${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-assign-${runId}`;
  const contactPhone = (n: number) => `+9129${String(runId).slice(-6)}${n}`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let appSecret: string;
  let agentAId: string;
  let agentBId: string;

  beforeAll(async () => {
    sentEmails = [];
    let sendCounter = 0;
    metaApiClient = {
      sendTextMessage: jest.fn(() => Promise.resolve(`wamid.assign-${runId}-${++sendCounter}`)),
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

    // Owner: register -> verify -> create workspace.
    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Assign Owner",
      email: ownerEmail,
      mobileNumber: ownerMobile,
      password,
    });
    const ownerToken = extractToken(extractLink(ownerEmail, "email-verification"));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: ownerToken });
    const tokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data.tokens;

    const createRes = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ name: "Assign Test Co" });
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
        displayPhoneNumber: "+91 90000 00006",
        verifiedName: "Assign Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-assign-${runId}`,
      businessName: "Assign Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    // Two real SALES_EXECUTIVE members, via the real invite/accept flow.
    agentAId = await inviteAndAcceptAgent(agentAEmail, agentAMobile, "Agent A");
    agentBId = await inviteAndAcceptAgent(agentBEmail, agentBMobile, "Agent B");
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

  function extractLink(to: string, category: string): string {
    const job = sentEmails.find((email) => email.to === to && email.category === category);
    const link = job?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) {
      throw new Error(`No ${category} email found for ${to}`);
    }
    return link;
  }

  /** Register, verify, invite as SALES_EXECUTIVE, accept — returns the new member's user id. */
  async function inviteAndAcceptAgent(
    email: string,
    mobileNumber: string,
    fullName: string,
  ): Promise<string> {
    await request(server()).post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const verifyToken = extractToken(extractLink(email, "email-verification"));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const memberTokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    await authed("post", "/api/v1/team/invitations").send({ email, role: "SALES_EXECUTIVE" });
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

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("waitFor timed out");
  }

  async function sendInbound(waMessageId: string, from: string): Promise<void> {
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
                contacts: [{ profile: { name: "Assign Contact" }, wa_id: from.slice(1) }],
                messages: [
                  {
                    from: from.slice(1),
                    id: waMessageId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Hello" },
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

  async function waitForAssignment(phone: string): Promise<ConversationSummary> {
    let conversation: ConversationSummary | undefined;
    await waitFor(async () => {
      try {
        conversation = await findConversationByPhone(phone);
        return conversation.assignedToUserId !== null;
      } catch {
        return false;
      }
    });
    return conversation!;
  }

  it("assigns brand-new Conversations via Round Robin, cycling through eligible agents", async () => {
    const patchRes = await authed("patch", "/api/v1/communication/automation-settings").send({
      assignmentStrategy: "ROUND_ROBIN",
    });
    expect(patchRes.status).toBe(200);

    const phone1 = contactPhone(1);
    const phone2 = contactPhone(2);
    const phone3 = contactPhone(3);

    await sendInbound(`wamid.assign-rr-1-${runId}`, phone1);
    const conversation1 = await waitForAssignment(phone1);
    expect(conversation1.assignedToUserId).toBe(agentAId);
    expect(conversation1.status).toBe("ASSIGNED");

    await sendInbound(`wamid.assign-rr-2-${runId}`, phone2);
    const conversation2 = await waitForAssignment(phone2);
    expect(conversation2.assignedToUserId).toBe(agentBId);

    // Wraps back around to Agent A.
    await sendInbound(`wamid.assign-rr-3-${runId}`, phone3);
    const conversation3 = await waitForAssignment(phone3);
    expect(conversation3.assignedToUserId).toBe(agentAId);
  });

  it("assigns brand-new Conversations via Least Active Agent once switched", async () => {
    // After the Round Robin test above, Agent A has 2 active Conversations
    // (phone1, phone3) and Agent B has 1 (phone2) — Least Active must pick
    // Agent B for the next brand-new Conversation.
    const patchRes = await authed("patch", "/api/v1/communication/automation-settings").send({
      assignmentStrategy: "LEAST_ACTIVE",
    });
    expect(patchRes.status).toBe(200);

    const phone4 = contactPhone(4);
    await sendInbound(`wamid.assign-la-1-${runId}`, phone4);
    const conversation4 = await waitForAssignment(phone4);
    expect(conversation4.assignedToUserId).toBe(agentBId);
  });
});
