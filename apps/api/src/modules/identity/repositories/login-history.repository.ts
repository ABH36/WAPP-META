import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  LoginHistoryEntry,
  LoginHistoryEntryDocument,
} from "../schemas/login-history-entry.schema.js";

export interface RecordLoginAttemptInput {
  userId: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const DEFAULT_HISTORY_LIMIT = 50;

/**
 * BR-007 (Volume-2) "Login History is immutable" — no update method exists,
 * and entries are never individually edited or deleted. `deleteOlderThan`
 * (Volume-4 §4.4, Data Retention) is the one sanctioned exception: a
 * workspace-configured, time-bound bulk cleanup, not an ad-hoc delete —
 * the same "immutable but retention-bound" treatment already applied to
 * `WebhookDeliveryLog`.
 */
@Injectable()
export class LoginHistoryRepository {
  constructor(
    @InjectModel(LoginHistoryEntry.name)
    private readonly loginHistoryModel: Model<LoginHistoryEntryDocument>,
  ) {}

  async record(input: RecordLoginAttemptInput): Promise<void> {
    await this.loginHistoryModel.create(input);
  }

  async findRecentByUser(
    userId: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<LoginHistoryEntryDocument[]> {
    return this.loginHistoryModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
  }

  /** Volume-4 §4.1 — workspace-wide Authentication audit visibility (Audit Logs presents this, never re-persists it). */
  async findByUsers(
    userIds: string[],
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<LoginHistoryEntryDocument[]> {
    return this.loginHistoryModel
      .find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /** Volume-4 §4.4 (Data Retention) — the one sanctioned bulk-delete path, see class comment. */
  async deleteOlderThan(userIds: string[], cutoffDate: Date): Promise<number> {
    const result = await this.loginHistoryModel
      .deleteMany({ userId: { $in: userIds }, createdAt: { $lt: cutoffDate } })
      .exec();
    return result.deletedCount;
  }
}
