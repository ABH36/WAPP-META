import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  UsageHistoryEntry,
  UsageHistoryEntryDocument,
} from "../schemas/usage-history-entry.schema.js";

export interface RecordUsageHistoryInput {
  workspaceId: string;
  eventType: string;
  description: string;
  metadata: object;
  occurredAt: Date;
}

/** Insert-only — same immutability shape as BillingHistoryRepository. No update or delete method exists here by design. */
@Injectable()
export class UsageHistoryRepository {
  constructor(
    @InjectModel(UsageHistoryEntry.name)
    private readonly entryModel: Model<UsageHistoryEntryDocument>,
  ) {}

  async record(input: RecordUsageHistoryInput): Promise<UsageHistoryEntryDocument> {
    return this.entryModel.create(input);
  }

  async list(workspaceId: string): Promise<UsageHistoryEntryDocument[]> {
    return this.entryModel.find({ workspaceId }).sort({ occurredAt: -1 }).exec();
  }
}
