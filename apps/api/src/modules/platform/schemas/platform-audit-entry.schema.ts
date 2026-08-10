import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";

export type PlatformAuditEntryDocument = HydratedDocument<PlatformAuditEntry>;

/**
 * PRD-007 Volume-3 §4.4 (Global Audit Center) — "Immutable. Append only."
 * Architecture Review, 2026-08-10 (hybrid model): this collection is the
 * canonical persistence ONLY for genuinely new platform-scoped events —
 * Break-Glass/Support Session lifecycle, plus PLATFORM_FEATURE_UPDATED/
 * PLATFORM_MAINTENANCE_ENABLED/DISABLED (introduced in Volume-1, never
 * durably audited anywhere until now). "Workspace Suspension" and
 * "Platform Billing Actions" — already durably captured by Settings'
 * AuditLogEntry and Billing's BillingHistoryEntry respectively — are
 * deliberately NOT re-persisted here; they're composed at read time
 * instead (see PlatformInvestigationService). Insert-only:
 * PlatformAuditRepository exposes no update/delete method, matching
 * BR-002's "immutable Audit entries." See
 * docs/ADR-PLAT-006-global-audit-center-strategy.md.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "platform_audit_entries" })
export class PlatformAuditEntry {
  @Prop({ type: String, required: true })
  eventType!: string;

  @Prop({ type: String, required: true })
  description!: string;

  // Null only for the 3 Volume-1 events (PLATFORM_FEATURE_UPDATED/
  // MAINTENANCE_ENABLED/DISABLED) — genuinely platform-wide, no single
  // workspace. Every Break-Glass/Support Session event always has one.
  @Prop({ type: String, default: null, index: true })
  workspaceId!: string | null;

  @Prop({ type: String, default: null })
  actorId!: string | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: Date, required: true, index: true })
  occurredAt!: Date;

  createdAt!: Date;
}

export const PlatformAuditEntrySchema = SchemaFactory.createForClass(PlatformAuditEntry);
