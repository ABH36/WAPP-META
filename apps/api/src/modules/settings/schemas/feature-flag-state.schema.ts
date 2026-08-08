import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type FeatureFlagStateDocument = HydratedDocument<FeatureFlagState>;

/**
 * §4.5 — workspace-level operational visibility toggles. Deliberately
 * distinct from `PlanLimits`' entitlement booleans (`crmEnabled`,
 * `broadcastEnabled`, etc. — per-Plan, commercial, static) — BR-005:
 * "Feature Flags never replace Billing entitlements." Names are chosen to
 * avoid colliding with `PlanLimits` field names so the two concepts stay
 * visually distinct in code. See docs/ADR-SET-007-audit-strategy.md.
 */
export enum FeatureFlagKey {
  CRM_MODULE = "CRM_MODULE",
  BILLING_MODULE = "BILLING_MODULE",
  COMMUNICATION_MODULE = "COMMUNICATION_MODULE",
  AI_ASSISTANT = "AI_ASSISTANT",
  BETA_FEATURES = "BETA_FEATURES",
}

@Schema({ timestamps: true, collection: "feature_flag_states" })
export class FeatureFlagState {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, enum: FeatureFlagKey, required: true })
  flagKey!: FeatureFlagKey;

  @Prop({ type: Boolean, required: true })
  enabled!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const FeatureFlagStateSchema = SchemaFactory.createForClass(FeatureFlagState);
FeatureFlagStateSchema.index({ workspaceId: 1, flagKey: 1 }, { unique: true });
