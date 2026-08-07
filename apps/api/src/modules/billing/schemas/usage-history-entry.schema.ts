import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";

export type UsageHistoryEntryDocument = HydratedDocument<UsageHistoryEntry>;

/**
 * Traces to: PRD-005 Volume-3 §13 (GET /billing/usage/history). Unlike
 * Billing History (Volume-2), §12 does not list a dedicated "Usage History
 * Recorded" event, so no meta-event is emitted here. One entry per Usage
 * domain event (USAGE_THRESHOLD_REACHED, USAGE_LIMIT_EXCEEDED,
 * FEATURE_ENABLED, FEATURE_DISABLED, WORKSPACE_LOCKED, WORKSPACE_UNLOCKED)
 * — a log of state changes/notifications, not a time series of raw counter
 * values. Same write-on-event, insert-only, immutable pattern already
 * established for Billing History (ADR-BILL-004/006). See
 * docs/ADR-BILL-007-usage-counter-strategy.md.
 */
@Schema({ timestamps: true, collection: "usage_history_entries" })
export class UsageHistoryEntry {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true })
  eventType!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  metadata!: object;

  @Prop({ type: Date, required: true, index: true })
  occurredAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UsageHistoryEntrySchema = SchemaFactory.createForClass(UsageHistoryEntry);
