import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  BillingHistoryEntry,
  BillingHistoryEntryDocument,
} from "../schemas/billing-history-entry.schema.js";

export interface RecordBillingHistoryInput {
  workspaceId: string;
  eventType: string;
  description: string;
  metadata: object;
  occurredAt: Date;
}

/** Insert-only — §6/§13 "Immutable" / "never edited, never deleted." No update or delete method exists here by design. */
@Injectable()
export class BillingHistoryRepository {
  constructor(
    @InjectModel(BillingHistoryEntry.name)
    private readonly entryModel: Model<BillingHistoryEntryDocument>,
  ) {}

  async record(input: RecordBillingHistoryInput): Promise<BillingHistoryEntryDocument> {
    return this.entryModel.create(input);
  }
}
