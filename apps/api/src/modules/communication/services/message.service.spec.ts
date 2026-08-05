import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MessageService } from "./message.service.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { TemplateRepository } from "../repositories/template.repository.js";
import { ComplianceEngineService } from "./compliance-engine.service.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { MessageDirection, MessageStatus, MessageType } from "../schemas/message.schema.js";
import { TemplateStatus } from "../schemas/template.schema.js";
import { MetaAuthenticationException } from "../exceptions/meta-api.exceptions.js";

describe("MessageService", () => {
  let service: MessageService;
  let connectionRepository: jest.Mocked<WhatsAppConnectionRepository>;
  let phoneNumberRepository: jest.Mocked<PhoneNumberRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let templateRepository: jest.Mocked<TemplateRepository>;
  let complianceEngine: jest.Mocked<ComplianceEngineService>;
  let metaApiClient: jest.Mocked<MetaApiClient>;
  let tokenEncryption: jest.Mocked<TokenEncryptionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: WhatsAppConnectionRepository,
          useValue: { findByWorkspace: jest.fn(), recordError: jest.fn() },
        },
        { provide: PhoneNumberRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: ContactRepository, useValue: { findOrCreate: jest.fn() } },
        {
          provide: MessageRepository,
          useValue: { create: jest.fn(), findByContact: jest.fn(), findByConversation: jest.fn() },
        },
        {
          provide: ConversationRepository,
          useValue: { recordActivity: jest.fn(), findByContact: jest.fn() },
        },
        { provide: TemplateRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: ComplianceEngineService, useValue: { assertFreeTextAllowed: jest.fn() } },
        {
          provide: MetaApiClient,
          useValue: { sendTextMessage: jest.fn(), sendTemplateMessage: jest.fn() },
        },
        { provide: TokenEncryptionService, useValue: { decrypt: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(MessageService);
    connectionRepository = moduleRef.get(WhatsAppConnectionRepository);
    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    contactRepository = moduleRef.get(ContactRepository);
    messageRepository = moduleRef.get(MessageRepository);
    conversationRepository = moduleRef.get(ConversationRepository);
    templateRepository = moduleRef.get(TemplateRepository);
    complianceEngine = moduleRef.get(ComplianceEngineService);
    metaApiClient = moduleRef.get(MetaApiClient);
    tokenEncryption = moduleRef.get(TokenEncryptionService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("sends a text message and records it", async () => {
    phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({
      _id: { toString: () => "phone-1" },
      phoneNumberId: "meta-phone-1",
    } as never);
    connectionRepository.findByWorkspace.mockResolvedValue({
      accessTokenEncrypted: "encrypted-token",
    } as never);
    tokenEncryption.decrypt.mockReturnValue("raw-access-token");
    metaApiClient.sendTextMessage.mockResolvedValue("wamid.OUT1");
    contactRepository.findOrCreate.mockResolvedValue({
      _id: { toString: () => "contact-1" },
    } as never);
    conversationRepository.findByContact.mockResolvedValue({
      lastCustomerMessageAt: new Date(),
    } as never);
    conversationRepository.recordActivity.mockResolvedValue({
      _id: { toString: () => "conversation-1" },
    } as never);
    messageRepository.create.mockResolvedValue({
      _id: { toString: () => "message-1" },
      conversationId: { toString: () => "conversation-1" },
      contactId: { toString: () => "contact-1" },
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEXT,
      text: "Hello",
      status: MessageStatus.SENT,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    } as never);

    const result = await service.sendText("workspace-1", "phone-1", "user-1", {
      to: "+919876543210",
      text: "Hello",
    });

    expect(complianceEngine.assertFreeTextAllowed).toHaveBeenCalled();
    expect(metaApiClient.sendTextMessage).toHaveBeenCalledWith(
      "meta-phone-1",
      "raw-access-token",
      "+919876543210",
      "Hello",
    );
    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: "wamid.OUT1", direction: MessageDirection.OUTBOUND }),
    );
    expect(result.id).toBe("message-1");
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "communication.message_sent",
      expect.objectContaining({ waMessageId: "wamid.OUT1", sentBy: "user-1" }),
    );
  });

  it("throws when the phone number doesn't belong to the workspace", async () => {
    phoneNumberRepository.findByIdForWorkspace.mockResolvedValue(null);
    await expect(
      service.sendText("workspace-1", "not-mine", "user-1", { to: "+919876543210", text: "Hi" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws when the workspace has no WhatsApp connection", async () => {
    phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({
      _id: { toString: () => "phone-1" },
      phoneNumberId: "meta-phone-1",
    } as never);
    connectionRepository.findByWorkspace.mockResolvedValue(null);

    await expect(
      service.sendText("workspace-1", "phone-1", "user-1", { to: "+919876543210", text: "Hi" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("marks the connection ERROR when Meta reports an authentication failure", async () => {
    phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({
      _id: { toString: () => "phone-1" },
      phoneNumberId: "meta-phone-1",
    } as never);
    connectionRepository.findByWorkspace.mockResolvedValue({
      accessTokenEncrypted: "encrypted-token",
    } as never);
    contactRepository.findOrCreate.mockResolvedValue({
      _id: { toString: () => "contact-1" },
    } as never);
    conversationRepository.findByContact.mockResolvedValue({
      lastCustomerMessageAt: new Date(),
    } as never);
    tokenEncryption.decrypt.mockReturnValue("raw-access-token");
    metaApiClient.sendTextMessage.mockRejectedValue(
      new MetaAuthenticationException("Token expired"),
    );

    await expect(
      service.sendText("workspace-1", "phone-1", "user-1", { to: "+919876543210", text: "Hi" }),
    ).rejects.toThrow(MetaAuthenticationException);
    expect(connectionRepository.recordError).toHaveBeenCalledWith("workspace-1", "Token expired");
    expect(messageRepository.create).not.toHaveBeenCalled();
  });

  it("never calls Meta when the compliance engine rejects the send", async () => {
    phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({
      _id: { toString: () => "phone-1" },
      phoneNumberId: "meta-phone-1",
    } as never);
    connectionRepository.findByWorkspace.mockResolvedValue({
      accessTokenEncrypted: "encrypted-token",
    } as never);
    contactRepository.findOrCreate.mockResolvedValue({
      _id: { toString: () => "contact-1" },
    } as never);
    conversationRepository.findByContact.mockResolvedValue(null);
    complianceEngine.assertFreeTextAllowed.mockImplementation(() => {
      throw new ForbiddenException("outside window");
    });

    await expect(
      service.sendText("workspace-1", "phone-1", "user-1", { to: "+919876543210", text: "Hi" }),
    ).rejects.toThrow(ForbiddenException);
    expect(metaApiClient.sendTextMessage).not.toHaveBeenCalled();
  });

  describe("sendTemplate", () => {
    beforeEach(() => {
      phoneNumberRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "phone-1" },
        phoneNumberId: "meta-phone-1",
      } as never);
      connectionRepository.findByWorkspace.mockResolvedValue({
        accessTokenEncrypted: "encrypted-token",
        wabaId: "waba-1",
      } as never);
      tokenEncryption.decrypt.mockReturnValue("raw-access-token");
    });

    it("throws NotFoundException when the template doesn't exist", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.sendTemplate("workspace-1", "phone-1", "user-1", {
          to: "+919876543210",
          templateId: "template-1",
          bodyParameters: [],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(metaApiClient.sendTemplateMessage).not.toHaveBeenCalled();
    });

    it("throws when the template isn't APPROVED", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.PENDING,
        name: "order_update",
        language: "en_US",
      } as never);

      await expect(
        service.sendTemplate("workspace-1", "phone-1", "user-1", {
          to: "+919876543210",
          templateId: "template-1",
          bodyParameters: [],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(metaApiClient.sendTemplateMessage).not.toHaveBeenCalled();
    });

    it("sends an approved template, bypassing the compliance engine entirely", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "template-1" },
        status: TemplateStatus.APPROVED,
        name: "order_update",
        language: "en_US",
        components: [{ type: "BODY", text: "Hi {{1}}, your order shipped." }],
      } as never);
      metaApiClient.sendTemplateMessage.mockResolvedValue("wamid.TPL1");
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
      } as never);
      conversationRepository.recordActivity.mockResolvedValue({
        _id: { toString: () => "conversation-1" },
      } as never);
      messageRepository.create.mockResolvedValue({
        _id: { toString: () => "message-2" },
        conversationId: { toString: () => "conversation-1" },
        contactId: { toString: () => "contact-1" },
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEMPLATE,
        text: "Hi John, your order shipped.",
        status: MessageStatus.SENT,
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never);

      const result = await service.sendTemplate("workspace-1", "phone-1", "user-1", {
        to: "+919876543210",
        templateId: "template-1",
        bodyParameters: ["John"],
      });

      expect(complianceEngine.assertFreeTextAllowed).not.toHaveBeenCalled();
      expect(metaApiClient.sendTemplateMessage).toHaveBeenCalledWith(
        "meta-phone-1",
        "raw-access-token",
        "+919876543210",
        "order_update",
        "en_US",
        ["John"],
      );
      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: MessageType.TEMPLATE, waMessageId: "wamid.TPL1" }),
      );
      expect(result.id).toBe("message-2");
    });
  });
});
