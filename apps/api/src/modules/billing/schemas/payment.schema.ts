import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { PaymentStatus } from "@wapp/shared-types";

export type PaymentDocument = HydratedDocument<Payment>;

/**
 * Traces to: PRD-005 Volume-2 §8 (Payment Entity). §9 — one Invoice may
 * have multiple Payment attempts (each a separate document, never
 * overwritten); a Failed Payment stays historical and is never deleted or
 * mutated back to PENDING. Reuses the already-approved, pre-scaffolded
 * PaymentStatus enum (packages/shared-types/src/enums/payment-status.enum.ts,
 * ADR-039) as-is — resolved 2026-08-07, Architecture Review: no second,
 * conflicting status naming for the same concept. See
 * docs/ADR-BILL-004-invoice-payment-relationship.md.
 *
 * Recorded manually (POST /billing/payments) — Payment Gateway Integration
 * is §14 Out of Scope, so `gateway`/`gatewayReference` describe how the
 * payment was actually settled (e.g. bank transfer reference), not a live
 * gateway callback. Who may record one is deliberately narrower than
 * BILLING_ACCESS alone would allow — see TD-010 and PaymentController.
 */
@Schema({ timestamps: true, collection: "payments" })
export class Payment {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Invoice", required: true, index: true })
  invoiceId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  gateway!: string;

  @Prop({ type: String, required: true, trim: true })
  gatewayReference!: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: String, required: true, default: "INR" })
  currency!: string;

  @Prop({ type: String, enum: PaymentStatus, required: true, index: true })
  status!: PaymentStatus;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ type: Date, default: null })
  refundedAt!: Date | null;

  @Prop({ type: String, required: true })
  recordedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
