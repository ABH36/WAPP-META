import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  getPermissionLevel,
  Permission,
  PermissionLevel,
  WorkspaceMemberStatus,
} from "@wapp/shared-types";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  ConversationAssignedPayload,
  ConversationNoteAddedPayload,
  ConversationStatusChangedPayload,
} from "../../../common/events/domain-events.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationNoteRepository } from "../repositories/conversation-note.repository.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { MessageService } from "./message.service.js";
import { ConversationStatus } from "../schemas/conversation.schema.js";
import { SYSTEM_ONLY_STATUSES } from "../conversation-state-machine.js";
import {
  toConversationNoteSummary,
  toConversationSummary,
  toMessageSummary,
} from "../mappers/communication.mapper.js";
import type {
  ConversationNoteSummary,
  ConversationSummary,
  MessageSummary,
} from "../communication.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface ListConversationsOptions {
  status?: ConversationStatus;
  assignedToUserId?: string;
  page?: number;
  limit?: number;
}

/**
 * Orchestrates the Shared Inbox / Conversation lifecycle (PRD-003 Part 2).
 * Depends on MessageService (for reply()) but never the other way around —
 * MessageService/WebhookService talk to ConversationRepository directly for
 * the automatic activity-based status nudge, specifically to avoid a
 * circular dependency with this service.
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationNoteRepository: ConversationNoteRepository,
    private readonly contactRepository: ContactRepository,
    private readonly messageRepository: MessageRepository,
    private readonly messageService: MessageService,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(
    workspaceId: string,
    options: ListConversationsOptions,
  ): Promise<Paginated<ConversationSummary>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0
        ? Math.min(options.limit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    const { items, total } = await this.conversationRepository.list(
      workspaceId,
      { status: options.status, assignedToUserId: options.assignedToUserId },
      page,
      limit,
    );

    return {
      items: items.map(toConversationSummary),
      meta: {
        page,
        pageSize: limit,
        totalRecords: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getById(workspaceId: string, conversationId: string): Promise<ConversationSummary> {
    const conversation = await this.findOrThrow(workspaceId, conversationId);
    return toConversationSummary(conversation);
  }

  async listMessages(
    workspaceId: string,
    conversationId: string,
    limit = 50,
  ): Promise<MessageSummary[]> {
    await this.findOrThrow(workspaceId, conversationId);
    const messages = await this.messageRepository.findByConversation(
      workspaceId,
      conversationId,
      limit,
    );
    return messages.map(toMessageSummary);
  }

  async reply(
    workspaceId: string,
    conversationId: string,
    actorId: string,
    text: string,
  ): Promise<MessageSummary> {
    const conversation = await this.findOrThrow(workspaceId, conversationId);
    const contact = await this.contactRepository.findByIdForWorkspace(
      workspaceId,
      conversation.contactId.toString(),
    );
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    return this.messageService.sendText(
      workspaceId,
      conversation.phoneNumberId.toString(),
      actorId,
      {
        to: contact.phoneNumber,
        text,
      },
    );
  }

  /** Template reply — the only reply path available once a conversation is outside the 24h compliance window (see ComplianceEngineService). */
  async replyWithTemplate(
    workspaceId: string,
    conversationId: string,
    actorId: string,
    templateId: string,
    bodyParameters: string[],
  ): Promise<MessageSummary> {
    const conversation = await this.findOrThrow(workspaceId, conversationId);
    const contact = await this.contactRepository.findByIdForWorkspace(
      workspaceId,
      conversation.contactId.toString(),
    );
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    return this.messageService.sendTemplate(
      workspaceId,
      conversation.phoneNumberId.toString(),
      actorId,
      {
        to: contact.phoneNumber,
        templateId,
        bodyParameters,
      },
    );
  }

  async updateStatus(
    workspaceId: string,
    conversationId: string,
    newStatus: ConversationStatus,
    actorId: string,
  ): Promise<ConversationSummary> {
    if (SYSTEM_ONLY_STATUSES.has(newStatus)) {
      throw new BadRequestException(`Status ${newStatus} cannot be set manually`);
    }
    const conversation = await this.findOrThrow(workspaceId, conversationId);
    const previousStatus = conversation.status;

    const updated = await this.conversationRepository.updateStatus(
      workspaceId,
      conversationId,
      newStatus,
    );
    if (!updated) {
      throw new NotFoundException("Conversation not found");
    }

    this.eventEmitter.emit(DomainEvent.CONVERSATION_STATUS_CHANGED, {
      workspaceId,
      conversationId,
      contactId: updated.contactId.toString(),
      previousStatus,
      newStatus,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ConversationStatusChangedPayload);

    return toConversationSummary(updated);
  }

  async assign(
    workspaceId: string,
    conversationId: string,
    assignedToUserId: string | null,
    actorId: string,
  ): Promise<ConversationSummary> {
    const conversation = await this.findOrThrow(workspaceId, conversationId);

    if (assignedToUserId) {
      const assignee = await this.userRepository.findById(assignedToUserId);
      if (
        !assignee ||
        assignee.workspaceId !== workspaceId ||
        assignee.workspaceMemberStatus !== WorkspaceMemberStatus.ACTIVE
      ) {
        throw new BadRequestException("Assignee must be an active member of this workspace");
      }
      if (
        !assignee.role ||
        getPermissionLevel(assignee.role, Permission.REPLY_CONVERSATIONS) === PermissionLevel.NONE
      ) {
        throw new BadRequestException("Assignee's role does not have Shared Inbox access");
      }
    }

    // Assigning a fresh/unassigned conversation promotes it out of NEW/OPEN;
    // unassigning an ASSIGNED conversation demotes it back to OPEN (an
    // "Assigned" conversation with no assignee is a contradiction). Any
    // other current status (PENDING/RESOLVED/CLOSED/SPAM/ARCHIVED) is left
    // alone — reassignment doesn't imply a lifecycle change on its own.
    let nextStatus: ConversationStatus | null = null;
    if (
      assignedToUserId &&
      (conversation.status === ConversationStatus.NEW ||
        conversation.status === ConversationStatus.OPEN)
    ) {
      nextStatus = ConversationStatus.ASSIGNED;
    } else if (!assignedToUserId && conversation.status === ConversationStatus.ASSIGNED) {
      nextStatus = ConversationStatus.OPEN;
    }

    const updated = await this.conversationRepository.assign(
      workspaceId,
      conversationId,
      assignedToUserId,
      nextStatus,
    );
    if (!updated) {
      throw new NotFoundException("Conversation not found");
    }

    this.eventEmitter.emit(DomainEvent.CONVERSATION_ASSIGNED, {
      workspaceId,
      conversationId,
      contactId: updated.contactId.toString(),
      assignedToUserId,
      actorId,
      occurredAt: new Date().toISOString(),
    } satisfies ConversationAssignedPayload);

    return toConversationSummary(updated);
  }

  async addNote(
    workspaceId: string,
    conversationId: string,
    authorUserId: string,
    text: string,
  ): Promise<ConversationNoteSummary> {
    const conversation = await this.findOrThrow(workspaceId, conversationId);

    const note = await this.conversationNoteRepository.create({
      workspaceId,
      conversationId,
      authorUserId,
      text,
    });

    this.eventEmitter.emit(DomainEvent.CONVERSATION_NOTE_ADDED, {
      workspaceId,
      conversationId,
      contactId: conversation.contactId.toString(),
      authorUserId,
      occurredAt: new Date().toISOString(),
    } satisfies ConversationNoteAddedPayload);

    return toConversationNoteSummary(note);
  }

  async listNotes(workspaceId: string, conversationId: string): Promise<ConversationNoteSummary[]> {
    await this.findOrThrow(workspaceId, conversationId);
    const notes = await this.conversationNoteRepository.findByConversation(
      workspaceId,
      conversationId,
    );
    return notes.map(toConversationNoteSummary);
  }

  /**
   * BDC-012 auto-close sweep — RESOLVED conversations past
   * CONVERSATION_AUTO_CLOSE_HOURS with no further activity move to CLOSED.
   * Called on a timer by ConversationAutoCloseProcessor, not by any request
   * path. Returns the number of conversations closed.
   */
  async autoCloseInactive(cutoff: Date): Promise<number> {
    const candidates = await this.conversationRepository.findResolvedBefore(cutoff);

    for (const conversation of candidates) {
      const updated = await this.conversationRepository.updateStatus(
        conversation.workspaceId,
        conversation._id.toString(),
        ConversationStatus.CLOSED,
      );
      if (!updated) continue;

      this.eventEmitter.emit(DomainEvent.CONVERSATION_STATUS_CHANGED, {
        workspaceId: conversation.workspaceId,
        conversationId: conversation._id.toString(),
        contactId: conversation.contactId.toString(),
        previousStatus: ConversationStatus.RESOLVED,
        newStatus: ConversationStatus.CLOSED,
        actorId: "SYSTEM",
        occurredAt: new Date().toISOString(),
      } satisfies ConversationStatusChangedPayload);
    }

    return candidates.length;
  }

  private async findOrThrow(workspaceId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findById(workspaceId, conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    return conversation;
  }
}
