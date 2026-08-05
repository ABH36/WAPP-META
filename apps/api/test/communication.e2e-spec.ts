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
import { ContactRepository } from "../src/modules/communication/repositories/contact.repository.js";
import { MessageRepository } from "../src/modules/communication/repositories/message.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import type { AppConfig } from "../src/config/configuration.js";

/**
 * Covers only what's verifiable without a completed Meta Embedded Signup
 * (no frontend for that exists yet — see MetaApiClient's own doc comment):
 * the webhook receiver's subscription handshake, signature verification,
 * and async inbound-message processing. The connect flow / outbound send
 * (both call the live Graph API) are covered by unit tests with
 * MetaApiClient mocked, not here.
 */
describe("Communication - Webhook receiver (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let contactRepository: ContactRepository;
  let messageRepository: MessageRepository;

  const runId = Date.now();
  const ownerEmail = `comm-owner-${runId}@example.com`;
  const ownerMobile = `+9111${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-${runId}`;

  let workspaceId: string;
  let appSecret: string;
  let webhookVerifyToken: string;

  beforeAll(async () => {
    sentEmails = [];
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
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    contactRepository = moduleRef.get(ContactRepository);
    messageRepository = moduleRef.get(MessageRepository);

    const configService = moduleRef.get<ConfigService<AppConfig, true>>(ConfigService);
    const metaConfig = configService.get("meta", { infer: true });
    appSecret = metaConfig.appSecret;
    webhookVerifyToken = metaConfig.webhookVerifyToken;

    // Register + verify an Owner, create a workspace, seed a PhoneNumber
    // directly (bypassing the real connect flow, which needs a live Meta
    // Embedded Signup this test suite deliberately doesn't attempt).
    await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Comm Owner",
        email: ownerEmail,
        mobileNumber: ownerMobile,
        password,
      });
    const link = sentEmails.find((e) => e.to === ownerEmail)?.html.match(/href="([^"]+)"/)?.[1];
    const token = new URL(link ?? "").searchParams.get("token") ?? "";
    const verifyRes = await request(app.getHttpServer() as Server)
      .post("/api/v1/auth/verify-email")
      .send({ token });
    const ownerTokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    const createRes = await request(app.getHttpServer() as Server)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerTokens.accessToken}`)
      .send({ name: "Comm Test Co" });
    workspaceId = (createRes.body as ApiSuccessResponse<{ workspace: WorkspaceProfile }>).data
      .workspace.id;

    await phoneNumberRepository.upsert(
      workspaceId,
      new Types.ObjectId().toString(),
      metaPhoneNumberId,
      {
        displayPhoneNumber: "+91 90000 00000",
        verifiedName: "Comm Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  // Sends the pre-serialized JSON *string* (not the plain object) so the
  // exact bytes signed here are the exact bytes transmitted — supertest/
  // superagent passes a string body through unchanged instead of
  // re-serializing it, which a plain-object `.send()` would do via its own
  // independent JSON.stringify call, risking a byte mismatch against the
  // signature even for a semantically-identical payload.
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

  it("echoes the challenge on a correct subscription handshake", async () => {
    const response = await request(server()).get("/api/webhooks/whatsapp").query({
      "hub.mode": "subscribe",
      "hub.verify_token": webhookVerifyToken,
      "hub.challenge": "challenge-123",
    });
    expect(response.status).toBe(200);
    expect(response.text).toBe("challenge-123");
  });

  it("rejects a subscription handshake with the wrong verify token", async () => {
    const response = await request(server()).get("/api/webhooks/whatsapp").query({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "challenge-123",
    });
    expect(response.status).toBe(403);
  });

  it("rejects a POST with an invalid signature", async () => {
    const response = await request(server())
      .post("/api/webhooks/whatsapp")
      .set(
        "X-Hub-Signature-256",
        "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      )
      .send({ object: "whatsapp_business_account", entry: [] });
    expect(response.status).toBe(403);
  });

  it("accepts a validly-signed inbound text message and processes it asynchronously", async () => {
    const contactPhone = `+9122${String(runId).slice(-8)}`;
    const waMessageId = `wamid.e2e-${runId}`;
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
                contacts: [{ profile: { name: "E2E Contact" }, wa_id: contactPhone.slice(1) }],
                messages: [
                  {
                    from: contactPhone.slice(1),
                    id: waMessageId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Hello from the e2e test" },
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

    await waitFor(async () => {
      const message = await messageRepository.findByWaMessageId(waMessageId);
      return message !== null;
    });

    const message = await messageRepository.findByWaMessageId(waMessageId);
    expect(message?.text).toBe("Hello from the e2e test");
    expect(message?.workspaceId).toBe(workspaceId);

    const contact = await contactRepository.findByIdForWorkspace(
      workspaceId,
      message!.contactId.toString(),
    );
    expect(contact?.phoneNumber).toBe(contactPhone);
    expect(contact?.waProfileName).toBe("E2E Contact");
  });
});
