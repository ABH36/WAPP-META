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

/** Insert-only — BR-007 "Login History is immutable." No update or delete method exists here by design. */
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
}
