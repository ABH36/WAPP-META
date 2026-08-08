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

  /** PRD-007 Volume-2 §4.5 — the first read path over this collection (its own schema comment named PRD-005 Volume-4 as the "expected first reader," but that volume never ended up needing it — this is it). */
  async findByWorkspace(
    workspaceId: string,
    limit: number,
  ): Promise<BillingHistoryEntryDocument[]> {
    return this.entryModel.find({ workspaceId }).sort({ occurredAt: -1 }).limit(limit).exec();
  }

  /** PRD-007 Volume-2 §4.7 (Billing Dashboard, Trial Extensions) — cross-tenant, deliberately no workspaceId filter. */
  async countByEventType(eventType: string): Promise<number> {
    return this.entryModel.countDocuments({ eventType }).exec();
  }
}
