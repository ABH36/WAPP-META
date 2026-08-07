import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";

export type BillingHistoryEntryDocument = HydratedDocument<BillingHistoryEntry>;

/**
 * Traces to: PRD-005 Volume-2 §6 (Billing History) — "Business Timeline...
 * Immutable." Written by BillingHistoryListener, one entry per Billing
 * domain event (Subscription's Volume-1 catalog + Invoice/Payment's new
 * Volume-2 events) — same write-on-event pattern already established for
 * CRM's Activity Timeline (docs/ADR-CRM-015-activity-timeline-strategy.md),
 * not a live cross-collection join. Insert-only: BillingHistoryRepository
 * exposes no update/delete method, matching §6's "Immutable" and §13's
 * "Billing History never: be edited, be deleted." No GET endpoint exists
 * for this in Volume-2 (§11 lists none) — Volume-4 (Billing Reports & Admin)
 * is the expected first reader. See
 * docs/ADR-BILL-004-invoice-payment-relationship.md.
 */
@Schema({ timestamps: true, collection: "billing_history_entries" })
export class BillingHistoryEntry {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  // The raw DomainEvent constant (e.g. "billing.invoice_generated"), not a
  // hand-written label — keeps this traceable back to the exact event that
  // produced it.
  @Prop({ type: String, required: true })
  eventType!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  metadata!: Record<string, unknown>;

  @Prop({ type: Date, required: true, index: true })
  occurredAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BillingHistoryEntrySchema = SchemaFactory.createForClass(BillingHistoryEntry);
