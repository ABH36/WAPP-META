import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { MessageSentPayload } from "../../../common/events/domain-events.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { toMessageSummary } from "../mappers/communication.mapper.js";
import type { MessageSummary } from "../communication.types.js";
import type { SendMessageDto } from "../dto/send-message.dto.js";
import { MessageDirection, MessageStatus, MessageType } from "../schemas/message.schema.js";
import { MetaAuthenticationException } from "../exceptions/meta-api.exceptions.js";

/**
 * Outbound text-message sending (PRD-003 Part 1 scope — template messages
 * belong to Part 3). Deliberately does not implement the 24-hour customer-
 * service-window compliance check (PRD-003 Part 3's Compliance Engine) —
 * that's later scope; flagged in the Phase-4 Part-1 completion report as a
 * known gap, not silently skipped.
 */
@Injectable()
export class MessageService {
  constructor(
    private readonly connectionRepository: WhatsAppConnectionRepository,
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly contactRepository: ContactRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly metaApiClient: MetaApiClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async sendText(
    workspaceId: string,
    phoneNumberDbId: string,
    sentBy: string,
    dto: SendMessageDto,
  ): Promise<MessageSummary> {
    const phoneNumber = await this.phoneNumberRepository.findByIdForWorkspace(
      workspaceId,
      phoneNumberDbId,
    );
    if (!phoneNumber) {
      throw new NotFoundException("Phone number not found");
    }

    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    if (!connection) {
      throw new ForbiddenException("No WhatsApp connection for this workspace");
    }

    const accessToken = this.tokenEncryption.decrypt(connection.accessTokenEncrypted);
    let waMessageId: string;
    try {
      waMessageId = await this.metaApiClient.sendTextMessage(
        phoneNumber.phoneNumberId,
        accessToken,
        dto.to,
        dto.text,
      );
    } catch (error) {
      // COMM-META-ERROR-HANDLING-STRATEGY.md — an auth failure means the
      // customer's WABA token is no longer valid; the connection needs the
      // Owner/Admin to reconnect (Embedded Signup again), not a retry.
      if (error instanceof MetaAuthenticationException) {
        await this.connectionRepository.recordError(workspaceId, error.message);
      }
      throw error;
    }

    const contact = await this.contactRepository.findOrCreate(workspaceId, dto.to, null);
    const occurredAt = new Date();
    const conversation = await this.conversationRepository.recordActivity(
      workspaceId,
      contact._id.toString(),
      phoneNumber._id.toString(),
      MessageDirection.OUTBOUND,
      occurredAt,
    );

    const message = await this.messageRepository.create({
      workspaceId,
      conversationId: conversation._id.toString(),
      phoneNumberId: phoneNumber._id.toString(),
      contactId: contact._id.toString(),
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEXT,
      text: dto.text,
      rawPayload: { to: dto.to, text: dto.text },
      waMessageId,
      status: MessageStatus.SENT,
      occurredAt,
    });

    this.eventEmitter.emit(DomainEvent.MESSAGE_SENT, {
      workspaceId,
      conversationId: conversation._id.toString(),
      contactId: contact._id.toString(),
      phoneNumberId: phoneNumber._id.toString(),
      waMessageId,
      sentBy,
      occurredAt: occurredAt.toISOString(),
    } satisfies MessageSentPayload);

    return toMessageSummary(message);
  }

  async listForContact(
    workspaceId: string,
    contactId: string,
    limit = 50,
  ): Promise<MessageSummary[]> {
    const messages = await this.messageRepository.findByContact(workspaceId, contactId, limit);
    return messages.map(toMessageSummary);
  }
}
