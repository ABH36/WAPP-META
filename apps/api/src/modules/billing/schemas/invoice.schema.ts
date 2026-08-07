import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { InvoiceStatus } from "@wapp/shared-types";

export type InvoiceDocument = HydratedDocument<Invoice>;

/**
 * Traces to: PRD-005 Volume-2 §7 (Invoice Entity). Generated internally by
 * InvoiceGenerationListener reacting to SUBSCRIPTION_UPGRADED (§13 — Invoice
 * never modifies Subscription/Workspace/CRM; the dependency runs the other
 * way, Invoice listens to Subscription's own events) — every Invoice is
 * created directly in ISSUED (no manual DRAFT-authoring path exists in
 * Volume-2's API surface, §11 has no POST /billing/invoices). See
 * docs/ADR-BILL-004-invoice-payment-relationship.md.
 *
 * amount/tax are nullable for the same reason Plan.monthlyPrice/yearlyPrice
 * are (TD-009): they derive from Plan pricing and a not-yet-approved tax
 * rate, neither of which exist yet. Persisting 0 would silently assert
 * "free"/"tax-exempt" — an unapproved commercial value. Tracked as TD-011.
 */
@Schema({ timestamps: true, collection: "invoices" })
export class Invoice {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Subscription", required: true })
  subscriptionId!: Types.ObjectId;

  // Per-workspace sequence (resolved 2026-08-07: not a single global
  // counter — see InvoiceCounter). Globally unique in practice because the
  // format embeds a workspace-derived segment, but the uniqueness guarantee
  // itself is per-workspace, not global.
  @Prop({ type: String, required: true, unique: true })
  invoiceNumber!: string;

  @Prop({ type: Number, default: null, min: 0 })
  amount!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  tax!: number | null;

  // India-only Phase-1 (D002) — same reasoning as Plan.currency.
  @Prop({ type: String, required: true, default: "INR" })
  currency!: string;

  @Prop({ type: Date, required: true })
  dueDate!: Date;

  @Prop({ type: Date, required: true })
  issuedAt!: Date;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ type: String, enum: InvoiceStatus, required: true, index: true })
  status!: InvoiceStatus;

  // Sweep idempotency marker (InvoiceLifecycleProcessor) — not a PRD field;
  // ensures INVOICE_OVERDUE fires exactly once per Invoice rather than once
  // per hourly sweep pass for as long as it stays overdue.
  @Prop({ type: Date, default: null })
  overdueNotifiedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
