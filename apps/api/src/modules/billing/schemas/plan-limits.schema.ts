import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type PlanLimitsDocument = HydratedDocument<PlanLimits>;

/**
 * Traces to: PRD-005 Volume-3 §5/§6/§10. A new, separate Usage-owned
 * collection keyed by planId — resolved 2026-08-07, Architecture Review:
 * the frozen Plan schema (Volume-1) stays untouched; §10's "Usage Rules" is
 * its own box downstream of Plan, not a field on Plan itself.
 *
 * Entitlements (§5) are all `true` for Starter/Growth/Enterprise in Phase-1
 * — traces to Plan's own Volume-1 schema comment ("same full feature set in
 * Phase-1, differing only by usage limits"), an already-established fact,
 * not a new invented decision.
 *
 * Numeric limits (§6) are nullable and seeded null — same
 * no-unapproved-commercial-value discipline already applied to
 * Plan.monthlyPrice/yearlyPrice (TD-009): a specific number like "10 team
 * members" is exactly as much an unapproved commercial figure as a price,
 * and null here means "not yet approved," not "unlimited" — tracked as
 * TD-014. campaigns/storage/apiRequests stay present as fields (matching
 * the same "declared for forward-compatibility" pattern as
 * PARTIALLY_REFUNDED in PaymentStatus) but nothing increments their
 * matching WorkspaceUsage counters yet — see TD-013.
 */
@Schema({ timestamps: true, collection: "plan_limits" })
export class PlanLimits {
  @Prop({ type: SchemaTypes.ObjectId, ref: "Plan", required: true, unique: true })
  planId!: Types.ObjectId;

  @Prop({ type: Boolean, required: true, default: true })
  crmEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  broadcastEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  campaignsEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  automationEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  teamMembersEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  reportsEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  apiAccessEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  webhooksEnabled!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  integrationsEnabled!: boolean;

  @Prop({ type: Number, default: null, min: 0 })
  teamMembersLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  customersLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  leadsLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  dealsLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  broadcastsLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  campaignsLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  messagesLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  storageLimit!: number | null;

  @Prop({ type: Number, default: null, min: 0 })
  apiRequestsLimit!: number | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlanLimitsSchema = SchemaFactory.createForClass(PlanLimits);
