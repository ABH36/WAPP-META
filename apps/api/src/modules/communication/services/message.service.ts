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
import { TemplateRepository } from "../repositories/template.repository.js";
import { ComplianceEngineService } from "./compliance-engine.service.js";
import { toMessageSummary } from "../mappers/communication.mapper.js";
import type { MessageSummary } from "../communication.types.js";
import type { SendMessageDto } from "../dto/send-message.dto.js";
import type { SendTemplateMessageDto } from "../dto/send-template-message.dto.js";
import { MessageDirection, MessageStatus, MessageType } from "../schemas/message.schema.js";
import { TemplateStatus } from "../schemas/template.schema.js";
import { MetaAuthenticationException } from "../exceptions/meta-api.exceptions.js";

/**
 * Outbound message sending — free text (Part 1) and approved templates
 * (Part 3). Free-text sends are gated by ComplianceEngineService (the
 * 24-hour customer-service-window rule, BDC-008) *before* any Graph API
 * call is made; template sends are exempt (that's what templates are for)
 * and never call the compliance engine.
 */
@Injectable()
export class MessageService {
  constructor(
    private readonly connectionRepository: WhatsAppConnectionRepository,
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly contactRepository: ContactRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly complianceEngine: ComplianceEngineService,
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

    // Contact resolved before the compliance check (and, as a side effect,
    // before the Meta call) so the check can look up any existing
    // Conversation for this Contact — a brand-new Contact has none, which
    // correctly reads as "outside the window" (a cold free-text message to
    // someone who's never messaged in is never compliant).
    const contact = await this.contactRepository.findOrCreate(workspaceId, dto.to, null);
    const existingConversation = await this.conversationRepository.findByContact(
      workspaceId,
      contact._id.toString(),
    );
    this.complianceEngine.assertFreeTextAllowed(existingConversation);

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

  /**
   * Sends an approved template message — exempt from the 24-hour window
   * (that's the entire point of a template), so it's the only outbound path
   * available once a conversation is outside it. `bodyParameters` are
   * substituted in order into the template's BODY component; header/button
   * parameters aren't supported by this slice (see
   * docs/COMM-TEMPLATE-LIFECYCLE.md).
   */
  async sendTemplate(
    workspaceId: string,
    phoneNumberDbId: string,
    sentBy: string,
    dto: SendTemplateMessageDto,
    broadcastId?: string,
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

    const template = await this.templateRepository.findByIdForWorkspace(
      workspaceId,
      dto.templateId,
    );
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    if (template.status !== TemplateStatus.APPROVED) {
      throw new ForbiddenException(
        `Template is not approved for sending (current status: ${template.status})`,
      );
    }

    const accessToken = this.tokenEncryption.decrypt(connection.accessTokenEncrypted);
    let waMessageId: string;
    try {
      waMessageId = await this.metaApiClient.sendTemplateMessage(
        phoneNumber.phoneNumberId,
        accessToken,
        dto.to,
        template.name,
        template.language,
        dto.bodyParameters,
      );
    } catch (error) {
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

    const bodyComponent = template.components.find((c) => c.type === "BODY");
    const previewText = this.renderTemplatePreview(bodyComponent?.text ?? "", dto.bodyParameters);

    const message = await this.messageRepository.create({
      workspaceId,
      conversationId: conversation._id.toString(),
      phoneNumberId: phoneNumber._id.toString(),
      contactId: contact._id.toString(),
      broadcastId: broadcastId ?? null,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEMPLATE,
      text: previewText,
      rawPayload: {
        templateId: template._id.toString(),
        templateName: template.name,
        language: template.language,
        bodyParameters: dto.bodyParameters,
      },
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

  /** Substitutes {{1}}, {{2}}, ... in a template's BODY text — display/history purposes only, never sent to Meta (Meta receives structured parameters, not this rendered string). */
  private renderTemplatePreview(bodyText: string, parameters: string[]): string {
    return parameters.reduce(
      (text, value, index) => text.replaceAll(`{{${index + 1}}}`, value),
      bodyText,
    );
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
