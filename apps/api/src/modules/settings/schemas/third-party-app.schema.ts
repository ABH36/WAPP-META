import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ThirdPartyAppStateDocument = HydratedDocument<ThirdPartyAppState>;

export enum ThirdPartyAppKey {
  ZAPIER = "ZAPIER",
  MAKE = "MAKE",
  PABBLY = "PABBLY",
  CUSTOM = "CUSTOM",
}

/** PRD-006 Volume-3 §4.6 — configuration only (enable/disable), no execution semantics of its own. */
@Schema({ timestamps: true, collection: "third_party_app_states" })
export class ThirdPartyAppState {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, enum: ThirdPartyAppKey, required: true })
  appKey!: ThirdPartyAppKey;

  @Prop({ type: Boolean, required: true, default: false })
  enabled!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ThirdPartyAppStateSchema = SchemaFactory.createForClass(ThirdPartyAppState);
ThirdPartyAppStateSchema.index({ workspaceId: 1, appKey: 1 }, { unique: true });
