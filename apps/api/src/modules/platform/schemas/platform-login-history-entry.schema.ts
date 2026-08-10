import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PlatformLoginHistoryEntryDocument = HydratedDocument<PlatformLoginHistoryEntry>;

/**
 * PRD-007 Volume-4 §4.4 (Compliance Dashboard, "Failed Login Attempts")
 * — a real, pre-existing gap found during this volume's architecture
 * review: unlike tenant Identity's `LoginHistoryEntry`, Platform staff
 * logins had zero failure-tracking before this volume
 * (`PlatformAuthService.login()` never persisted a failed attempt).
 * Mirrors `LoginHistoryEntry`'s shape deliberately rather than reusing
 * it — Platform authentication is a genuinely separate identity boundary
 * (ADR-PLAT-002), the same reasoning `PlatformSession` used to justify
 * not reusing tenant `Session`. Insert-only, written at every terminal
 * branch of `PlatformAuthService.login()`. See
 * docs/ADR-PLAT-008-platform-analytics-strategy.md.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: "platform_login_history_entries",
})
export class PlatformLoginHistoryEntry {
  @Prop({ type: String, default: null, index: true })
  platformUserId!: string | null;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: Boolean, required: true })
  success!: boolean;

  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  createdAt!: Date;
}

export const PlatformLoginHistoryEntrySchema =
  SchemaFactory.createForClass(PlatformLoginHistoryEntry);
