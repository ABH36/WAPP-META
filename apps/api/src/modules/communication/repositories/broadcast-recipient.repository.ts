import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  BroadcastRecipient,
  BroadcastRecipientDocument,
  BroadcastRecipientStatus,
} from "../schemas/broadcast-recipient.schema.js";

export interface BroadcastRecipientStats {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

@Injectable()
export class BroadcastRecipientRepository {
  constructor(
    @InjectModel(BroadcastRecipient.name)
    private readonly recipientModel: Model<BroadcastRecipientDocument>,
  ) {}

  async bulkCreatePending(
    workspaceId: string,
    broadcastId: string,
    contactIds: string[],
  ): Promise<void> {
    await this.recipientModel.insertMany(
      contactIds.map((contactId) => ({
        workspaceId,
        broadcastId,
        contactId,
        status: BroadcastRecipientStatus.PENDING,
      })),
    );
  }

  /** Batched cursor — a large Broadcast's recipient list is never loaded fully into memory at once (see docs/COMM-BROADCAST-LIFECYCLE.md's scaling note). */
  async findPendingBatch(
    broadcastId: string,
    limit: number,
  ): Promise<BroadcastRecipientDocument[]> {
    return this.recipientModel
      .find({ broadcastId, status: BroadcastRecipientStatus.PENDING })
      .limit(limit)
      .exec();
  }

  async markSent(id: string, messageId: string): Promise<void> {
    await this.recipientModel
      .updateOne(
        { _id: id },
        { $set: { status: BroadcastRecipientStatus.SENT, messageId, sentAt: new Date() } },
      )
      .exec();
  }

  async markFailed(id: string, errorDetail: string): Promise<void> {
    await this.recipientModel
      .updateOne({ _id: id }, { $set: { status: BroadcastRecipientStatus.FAILED, errorDetail } })
      .exec();
  }

  async findByBroadcast(
    workspaceId: string,
    broadcastId: string,
    page: number,
    limit: number,
  ): Promise<{ items: BroadcastRecipientDocument[]; total: number }> {
    const query = { workspaceId, broadcastId };
    const [items, total] = await Promise.all([
      this.recipientModel
        .find(query)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.recipientModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async getStats(broadcastId: string): Promise<BroadcastRecipientStats> {
    const rows = await this.recipientModel.aggregate<{
      _id: BroadcastRecipientStatus;
      count: number;
    }>([
      // Raw aggregate $match doesn't go through Mongoose's schema-cast layer
      // the way find() does — broadcastId must be a real ObjectId here, not
      // the string every other method on this repository accepts.
      { $match: { broadcastId: new Types.ObjectId(broadcastId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const stats: BroadcastRecipientStats = { pending: 0, sent: 0, failed: 0, total: 0 };
    for (const row of rows) {
      if (row._id === BroadcastRecipientStatus.PENDING) stats.pending = row.count;
      if (row._id === BroadcastRecipientStatus.SENT) stats.sent = row.count;
      if (row._id === BroadcastRecipientStatus.FAILED) stats.failed = row.count;
    }
    stats.total = stats.pending + stats.sent + stats.failed;
    return stats;
  }
}
