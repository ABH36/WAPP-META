import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Message,
  MessageDirection,
  MessageDocument,
  MessageStatus,
  MessageType,
} from "../schemas/message.schema.js";

export interface CreateMessageInput {
  workspaceId: string;
  conversationId: string;
  phoneNumberId: string;
  contactId: string;
  broadcastId?: string | null;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  rawPayload: Record<string, unknown>;
  waMessageId: string;
  status: MessageStatus;
  occurredAt: Date;
}

@Injectable()
export class MessageRepository {
  constructor(@InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>) {}

  async create(input: CreateMessageInput): Promise<MessageDocument> {
    return this.messageModel.create(input);
  }

  /** Idempotency check (webhook redelivery) — Meta's own message id is the natural dedup key. */
  async findByWaMessageId(waMessageId: string): Promise<MessageDocument | null> {
    return this.messageModel.findOne({ waMessageId }).exec();
  }

  async updateStatusByWaMessageId(
    waMessageId: string,
    status: MessageStatus,
    errorDetail: string | null = null,
  ): Promise<boolean> {
    const result = await this.messageModel
      .updateOne({ waMessageId }, { $set: { status, errorDetail } })
      .exec();
    return result.matchedCount > 0;
  }

  async findByContact(
    workspaceId: string,
    contactId: string,
    limit: number,
  ): Promise<MessageDocument[]> {
    return this.messageModel
      .find({ workspaceId, contactId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByConversation(
    workspaceId: string,
    conversationId: string,
    limit: number,
  ): Promise<MessageDocument[]> {
    return this.messageModel
      .find({ workspaceId, conversationId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }
}
