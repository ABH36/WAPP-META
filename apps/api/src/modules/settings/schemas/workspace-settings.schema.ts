import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WorkspaceSettingsDocument = HydratedDocument<WorkspaceSettings>;

/**
 * Traces to: PRD-006 Volume-1 §4 (Branding, Workspace Logo, Currency, Date
 * Format, Time Format). A new, separate Settings-owned collection — §3's
 * own rule is that Settings owns only fields with no existing bounded
 * -context owner; Business Profile/Business Hours/Notification Settings/
 * Language all stay on the frozen `Workspace` schema untouched (Volume-1
 * orchestrates those, never owns or duplicates them) — see
 * docs/ADR-SET-001-settings-ownership-strategy.md.
 *
 * `logoUrl`/`logoPublicId` hold only a reference — the actual upload goes
 * directly to Cloudinary via `StorageService`'s existing signed-upload
 * flow (SEC-016), reused as-is; Settings never handles file bytes — see
 * docs/ADR-SET-002-workspace-branding-strategy.md.
 *
 * currency/dateFormat/timeFormat default to India-market conventions,
 * the same "reasonable default" precedent already established by
 * Workspace.businessHours.timezone defaulting to "Asia/Kolkata" — these
 * are technical/UX defaults, not commercial values (TD-009's discipline
 * doesn't apply here: currency is a display preference, resolved
 * 2026-08-07, Architecture Review, unrelated to Billing's actual INR-only
 * commercial model).
 */
@Schema({ timestamps: true, collection: "workspace_settings" })
export class WorkspaceSettings {
  @Prop({ type: String, required: true, unique: true })
  workspaceId!: string;

  @Prop({ type: String, default: null })
  logoUrl!: string | null;

  @Prop({ type: String, default: null })
  logoPublicId!: string | null;

  @Prop({ type: String, required: true, default: "INR" })
  currency!: string;

  @Prop({ type: String, required: true, default: "DD/MM/YYYY" })
  dateFormat!: string;

  @Prop({ type: String, required: true, default: "24h" })
  timeFormat!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkspaceSettingsSchema = SchemaFactory.createForClass(WorkspaceSettings);
