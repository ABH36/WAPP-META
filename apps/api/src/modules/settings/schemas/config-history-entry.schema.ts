import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";

export type ConfigHistoryEntryDocument = HydratedDocument<ConfigHistoryEntry>;

/** §4.2 — the 6 supported areas. */
export enum ConfigHistoryArea {
  BRANDING = "BRANDING",
  PREFERENCES = "PREFERENCES",
  BUSINESS_HOURS = "BUSINESS_HOURS",
  NOTIFICATION_SETTINGS = "NOTIFICATION_SETTINGS",
  INTEGRATIONS = "INTEGRATIONS",
  FEATURE_FLAGS = "FEATURE_FLAGS",
}

/**
 * PRD-006 Volume-4 §4.2 — append-only (BR-003). `previousValue` is not
 * captured from the emitting event (WORKSPACE_UPDATED/SETTINGS_UPDATED
 * only ever carried a `section` marker, never a diff) — it's chained:
 * each new entry's `previousValue` is simply the immediately preceding
 * entry's `newValue` for the same (workspaceId, area), or null on the
 * first change ever recorded. `newValue` is a live read of current state
 * at the moment the triggering event fires. See
 * docs/ADR-SET-007-audit-strategy.md.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "config_history_entries" })
export class ConfigHistoryEntry {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, enum: ConfigHistoryArea, required: true, index: true })
  area!: ConfigHistoryArea;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  previousValue!: Record<string, unknown> | null;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  newValue!: Record<string, unknown>;

  @Prop({ type: String, required: true })
  changedBy!: string;

  createdAt!: Date;
}

export const ConfigHistoryEntrySchema = SchemaFactory.createForClass(ConfigHistoryEntry);
ConfigHistoryEntrySchema.index({ workspaceId: 1, area: 1, createdAt: -1 });
