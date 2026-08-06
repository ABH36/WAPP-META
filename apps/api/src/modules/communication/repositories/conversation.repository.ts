import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import {
  Conversation,
  ConversationDocument,
  ConversationStatus,
} from "../schemas/conversation.schema.js";
import { MessageDirection } from "../schemas/message.schema.js";
import { nextStatusOnActivity } from "../conversation-state-machine.js";

export interface ListConversationsFilter {
  status?: ConversationStatus;
  assignedToUserId?: string;
}

/** A Conversation still counts toward an agent's load until it leaves these statuses — mirrors the terminal set conversation-state-machine.ts treats as agent-decided/finished. */
const TERMINAL_CONVERSATION_STATUSES = [
  ConversationStatus.RESOLVED,
  ConversationStatus.CLOSED,
  ConversationStatus.SPAM,
  ConversationStatus.ARCHIVED,
];

export interface ListConversationsResult {
  items: ConversationDocument[];
  total: number;
}

@Injectable()
export class ConversationRepository {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async findById(workspaceId: string, id: string): Promise<ConversationDocument | null> {
    return this.conversationModel.findOne({ _id: id, workspaceId }).exec();
  }

  async findByContact(
    workspaceId: string,
    contactId: string,
  ): Promise<ConversationDocument | null> {
    return this.conversationModel.findOne({ workspaceId, contactId }).exec();
  }

  async list(
    workspaceId: string,
    filter: ListConversationsFilter,
    page: number,
    limit: number,
  ): Promise<ListConversationsResult> {
    const query: FilterQuery<ConversationDocument> = { workspaceId };
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.assignedToUserId) {
      query.assignedToUserId = filter.assignedToUserId;
    }

    const [items, total] = await Promise.all([
      this.conversationModel
        .find(query)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("contactId")
        .exec(),
      this.conversationModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: ConversationStatus,
  ): Promise<ConversationDocument | null> {
    const set: Record<string, unknown> = { status };
    set.resolvedAt = status === ConversationStatus.RESOLVED ? new Date() : null;
    set.closedAt = status === ConversationStatus.CLOSED ? new Date() : null;

    return this.conversationModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: set }, { new: true })
      .exec();
  }

  async assign(
    workspaceId: string,
    id: string,
    assignedToUserId: string | null,
    nextStatus: ConversationStatus | null,
  ): Promise<ConversationDocument | null> {
    const set: Record<string, unknown> = { assignedToUserId };
    if (nextStatus) {
      set.status = nextStatus;
    }
    return this.conversationModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: set }, { new: true })
      .exec();
  }

  /**
   * Get-or-create plus the automatic status nudge every new Message (either
   * direction) applies to its Conversation. Lives on the Repository (not
   * ConversationService) purely to avoid a circular DI dependency —
   * MessageService/WebhookService need this, and ConversationService
   * separately depends on MessageService for reply()); see
   * conversation-state-machine.ts for the actual decision logic, which is a
   * pure function, not embedded here.
   */
  async recordActivity(
    workspaceId: string,
    contactId: string,
    phoneNumberId: string,
    direction: MessageDirection,
    occurredAt: Date,
  ): Promise<ConversationDocument> {
    const existing = await this.conversationModel.findOne({ workspaceId, contactId }).exec();

    if (!existing) {
      return this.conversationModel.create({
        workspaceId,
        contactId,
        phoneNumberId,
        status:
          direction === MessageDirection.INBOUND ? ConversationStatus.NEW : ConversationStatus.OPEN,
        assignedToUserId: null,
        lastMessageAt: occurredAt,
        lastCustomerMessageAt: direction === MessageDirection.INBOUND ? occurredAt : null,
        resolvedAt: null,
        closedAt: null,
      });
    }

    const set: Record<string, unknown> = { lastMessageAt: occurredAt };
    if (direction === MessageDirection.INBOUND) {
      set.lastCustomerMessageAt = occurredAt;
    }

    const nextStatus = nextStatusOnActivity(
      existing.status,
      existing.assignedToUserId !== null,
      direction,
    );
    if (nextStatus && nextStatus !== existing.status) {
      set.status = nextStatus;
      set.resolvedAt = null;
      set.closedAt = null;
    }

    const updated = await this.conversationModel
      .findOneAndUpdate({ _id: existing._id }, { $set: set }, { new: true })
      .exec();
    // existing was just read successfully; the doc cannot vanish between the
    // two calls in this single-process flow.
    return updated!;
  }

  /** Auto-close sweep target set — Resolved conversations past the inactivity threshold. */
  async findResolvedBefore(cutoff: Date): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({ status: ConversationStatus.RESOLVED, resolvedAt: { $lte: cutoff } })
      .exec();
  }

  /** Part 4b (Auto Assignment) — Least Active Agent strategy's per-agent load signal. */
  async countActiveAssignedToUser(workspaceId: string, userId: string): Promise<number> {
    return this.conversationModel
      .countDocuments({
        workspaceId,
        assignedToUserId: userId,
        status: { $nin: TERMINAL_CONVERSATION_STATUSES },
      })
      .exec();
  }

  async updateWelcomeLastSentAt(id: string, at: Date): Promise<void> {
    await this.conversationModel.updateOne({ _id: id }, { $set: { welcomeLastSentAt: at } }).exec();
  }

  async updateAwayLastSentAt(id: string, at: Date): Promise<void> {
    await this.conversationModel.updateOne({ _id: id }, { $set: { awayLastSentAt: at } }).exec();
  }

  /**
   * Part 4c (SLA Monitoring) sweep target set — a Conversation whose
   * customer's last message is still the most recent message overall (no
   * agent has replied since, expressed as lastMessageAt == lastCustomerMessageAt
   * via $expr rather than a separate "awaiting reply" flag) and that wait
   * has lasted past `cutoff`. Excludes PENDING (deliberately "waiting on the
   * customer," per conversation-state-machine.ts — the business isn't the
   * one behind) and every terminal status. The same `cutoff` also gates
   * re-escalation: `lastEscalatedAt` must be null or itself before `cutoff`,
   * so an already-escalated Conversation isn't re-escalated again until a
   * full SLA window has passed with still no reply — see
   * docs/COMM-SLA-ESCALATION.md.
   */
  async findSlaBreachCandidates(cutoff: Date): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({
        status: { $nin: [...TERMINAL_CONVERSATION_STATUSES, ConversationStatus.PENDING] },
        lastCustomerMessageAt: { $ne: null, $lte: cutoff },
        $expr: { $eq: ["$lastMessageAt", "$lastCustomerMessageAt"] },
        $or: [{ lastEscalatedAt: null }, { lastEscalatedAt: { $lte: cutoff } }],
      })
      .exec();
  }

  async updateLastEscalatedAt(id: string, at: Date): Promise<void> {
    await this.conversationModel.updateOne({ _id: id }, { $set: { lastEscalatedAt: at } }).exec();
  }
}
