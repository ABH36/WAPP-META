import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";

export type PlatformFeatureFlagOverrideDocument = HydratedDocument<PlatformFeatureFlagOverride>;

/**
 * PRD-007 Volume-1 §4.5 — a platform-wide override tier sitting above
 * Settings' workspace-level `FeatureFlagState` (§4.5 approval: "extending
 * Settings with a platform-override tier"). Reuses Settings' own
 * `FeatureFlagKey` enum rather than a parallel key set — one flag catalog,
 * two tiers. One document per `flagKey` (upsert, never per-workspace) —
 * absence of a document means "no platform override," not "disabled."
 */
@Schema({ timestamps: true, collection: "platform_feature_flag_overrides" })
export class PlatformFeatureFlagOverride {
  @Prop({ type: String, enum: FeatureFlagKey, required: true, unique: true })
  flagKey!: FeatureFlagKey;

  @Prop({ type: Boolean, required: true })
  enabled!: boolean;

  @Prop({ required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformFeatureFlagOverrideSchema = SchemaFactory.createForClass(
  PlatformFeatureFlagOverride,
);
