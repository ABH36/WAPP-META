import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { FeatureFlagKey } from "./feature-flag-state.schema.js";

export type PlatformFeatureOverrideStateDocument = HydratedDocument<PlatformFeatureOverrideState>;

/**
 * PRD-007 Volume-1 §4.5 — Settings' own local read model of Platform
 * Administration's feature-override tier, kept in sync via
 * `PlatformFeatureOverrideListener`'s `@OnEvent(PLATFORM_FEATURE_UPDATED)`
 * handler rather than a direct cross-module call (Settings cannot depend on
 * Platform — one-directional dependency graph, same reasoning as
 * `WorkspaceMaintenanceState` for Maintenance Mode, ADR-SET-008). One
 * document per `flagKey`; absence means "no platform override."
 */
@Schema({ timestamps: true, collection: "platform_feature_override_states" })
export class PlatformFeatureOverrideState {
  @Prop({ type: String, enum: FeatureFlagKey, required: true, unique: true })
  flagKey!: FeatureFlagKey;

  @Prop({ type: Boolean, required: true })
  enabled!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PlatformFeatureOverrideStateSchema = SchemaFactory.createForClass(
  PlatformFeatureOverrideState,
);
