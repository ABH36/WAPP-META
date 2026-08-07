import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import { BillingCycle, SubscriptionStatus } from "@wapp/shared-types";

export type SubscriptionDocument = HydratedDocument<Subscription>;

/**
 * Traces to: PRD-005 Volume-1 §6 (Subscription Entity). Created reactively
 * by BillingModule's WorkspaceCreatedListener on WORKSPACE_CREATED, never
 * created directly by WorkspaceService — see
 * docs/ADR-BILL-001-subscription-ownership-strategy.md. BR-001 — exactly
 * one Subscription per Workspace, enforced by the unique index below.
 */
@Schema({ timestamps: true, collection: "subscriptions" })
export class Subscription {
  @Prop({ type: String, required: true, unique: true, index: true })
  workspaceId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Plan", required: true })
  planId!: Types.ObjectId;

  // §9 — a queued downgrade, applied at renewalDate by the lifecycle sweep
  // (resolved 2026-08-07: downgrades take effect at the next renewal, not
  // immediately, unlike Upgrade). Null unless a downgrade is pending.
  @Prop({ type: SchemaTypes.ObjectId, ref: "Plan", default: null })
  pendingPlanId!: Types.ObjectId | null;

  @Prop({ type: String, enum: SubscriptionStatus, required: true, index: true })
  status!: SubscriptionStatus;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  // The end of the current paid/trial period — when TRIAL, this mirrors
  // trialEndsAt; once a paid cycle starts, this is the renewal due date.
  @Prop({ type: Date, required: true })
  renewalDate!: Date;

  @Prop({ type: Date, default: null })
  trialEndsAt!: Date | null;

  @Prop({ type: Date, default: null })
  graceEndsAt!: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

  @Prop({ type: String, enum: BillingCycle, required: true })
  billingCycle!: BillingCycle;

  @Prop({ type: Boolean, default: true })
  autoRenew!: boolean;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
