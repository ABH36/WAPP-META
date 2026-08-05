import { createHmac } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WebhookService } from "./webhook.service.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { MessageDirection, MessageStatus, MessageType } from "../schemas/message.schema.js";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";

function sign(body: object): { raw: Buffer; signature: string } {
  const raw = Buffer.from(JSON.stringify(body));
  const signature = `sha256=${createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`;
  return { raw, signature };
}

describe("WebhookService", () => {
  let service: WebhookService;
  let phoneNumberRepository: jest.Mocked<PhoneNumberRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "meta") {
                return { appSecret: APP_SECRET, webhookVerifyToken: VERIFY_TOKEN };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        {
          provide: PhoneNumberRepository,
          useValue: { findByPhoneNumberId: jest.fn() },
        },
        {
          provide: ContactRepository,
          useValue: { findOrCreate: jest.fn() },
        },
        {
          provide: MessageRepository,
          useValue: {
            findByWaMessageId: jest.fn(),
            create: jest.fn(),
            updateStatusByWaMessageId: jest.fn(),
          },
        },
        { provide: ConversationRepository, useValue: { recordActivity: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(WebhookService);
    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    contactRepository = moduleRef.get(ContactRepository);
    messageRepository = moduleRef.get(MessageRepository);
    conversationRepository = moduleRef.get(ConversationRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("verifySubscription", () => {
    it("accepts a correct subscribe handshake", () => {
      expect(service.verifySubscription("subscribe", VERIFY_TOKEN)).toBe(true);
    });

    it("rejects a wrong verify token", () => {
      expect(service.verifySubscription("subscribe", "wrong-token")).toBe(false);
    });

    it("rejects a mode other than subscribe", () => {
      expect(service.verifySubscription("unsubscribe", VERIFY_TOKEN)).toBe(false);
    });
  });

  describe("verifySignature", () => {
    it("accepts a correctly signed payload", () => {
      const { raw, signature } = sign({ hello: "world" });
      expect(service.verifySignature(raw, signature)).toBe(true);
    });

    it("rejects a tampered payload", () => {
      const { signature } = sign({ hello: "world" });
      const tamperedBody = Buffer.from(JSON.stringify({ hello: "tampered" }));
      expect(service.verifySignature(tamperedBody, signature)).toBe(false);
    });

    it("rejects a missing signature header", () => {
      const { raw } = sign({ hello: "world" });
      expect(service.verifySignature(raw, undefined)).toBe(false);
    });

    it("rejects a malformed signature header", () => {
      const { raw } = sign({ hello: "world" });
      expect(service.verifySignature(raw, "not-sha256-prefixed")).toBe(false);
    });
  });

  describe("processEvent", () => {
    it("ignores payloads that aren't whatsapp_business_account objects", async () => {
      await service.processEvent({ object: "something_else" });
      expect(phoneNumberRepository.findByPhoneNumberId).not.toHaveBeenCalled();
    });

    it("creates a Contact and Message for a new inbound text message", async () => {
      phoneNumberRepository.findByPhoneNumberId.mockResolvedValue({
        _id: { toString: () => "phone-1" },
        workspaceId: "workspace-1",
      } as never);
      messageRepository.findByWaMessageId.mockResolvedValue(null);
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
      } as never);
      conversationRepository.recordActivity.mockResolvedValue({
        _id: { toString: () => "conversation-1" },
      } as never);

      await service.processEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-1",
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "meta-phone-1" },
                  contacts: [{ profile: { name: "Jane" }, wa_id: "919876543210" }],
                  messages: [
                    {
                      from: "919876543210",
                      id: "wamid.ABC123",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "Hello there" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(contactRepository.findOrCreate).toHaveBeenCalledWith(
        "workspace-1",
        "+919876543210",
        "Jane",
      );
      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          conversationId: "conversation-1",
          contactId: "contact-1",
          direction: MessageDirection.INBOUND,
          type: MessageType.TEXT,
          text: "Hello there",
          waMessageId: "wamid.ABC123",
          status: MessageStatus.VISIBLE,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.message_received",
        expect.objectContaining({ workspaceId: "workspace-1", waMessageId: "wamid.ABC123" }),
      );
    });

    it("skips a redelivered message it has already recorded (idempotency)", async () => {
      phoneNumberRepository.findByPhoneNumberId.mockResolvedValue({
        _id: { toString: () => "phone-1" },
        workspaceId: "workspace-1",
      } as never);
      messageRepository.findByWaMessageId.mockResolvedValue({ _id: "existing" } as never);

      await service.processEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "meta-phone-1" },
                  messages: [
                    {
                      from: "919876543210",
                      id: "wamid.ABC123",
                      timestamp: "1700000000",
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(contactRepository.findOrCreate).not.toHaveBeenCalled();
      expect(messageRepository.create).not.toHaveBeenCalled();
    });

    it("skips a message for a phone number it doesn't have on record", async () => {
      phoneNumberRepository.findByPhoneNumberId.mockResolvedValue(null);

      await service.processEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "unknown-number" },
                  messages: [
                    {
                      from: "919876543210",
                      id: "wamid.ABC123",
                      timestamp: "1700000000",
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(messageRepository.create).not.toHaveBeenCalled();
    });

    it("updates message status from a statuses event", async () => {
      await service.processEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: "wamid.OUT1", status: "delivered", timestamp: "1700000000" }],
                },
              },
            ],
          },
        ],
      });

      expect(messageRepository.updateStatusByWaMessageId).toHaveBeenCalledWith(
        "wamid.OUT1",
        MessageStatus.DELIVERED,
        null,
      );
    });
  });
});
