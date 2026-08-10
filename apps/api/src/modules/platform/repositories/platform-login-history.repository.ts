import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  PlatformLoginHistoryEntry,
  PlatformLoginHistoryEntryDocument,
} from "../schemas/platform-login-history-entry.schema.js";

export interface RecordPlatformLoginAttemptInput {
  platformUserId: string | null;
  email: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class PlatformLoginHistoryRepository {
  constructor(
    @InjectModel(PlatformLoginHistoryEntry.name)
    private readonly platformLoginHistoryModel: Model<PlatformLoginHistoryEntryDocument>,
  ) {}

  async record(input: RecordPlatformLoginAttemptInput): Promise<void> {
    await this.platformLoginHistoryModel.create(input);
  }

  async countAll(): Promise<number> {
    return this.platformLoginHistoryModel.countDocuments().exec();
  }

  async countFailed(): Promise<number> {
    return this.platformLoginHistoryModel.countDocuments({ success: false }).exec();
  }
}
