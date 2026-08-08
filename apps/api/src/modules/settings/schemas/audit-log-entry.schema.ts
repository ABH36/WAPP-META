import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";

export type AuditLogEntryDocument = HydratedDocument<AuditLogEntry>;

/** §4.1 — the 7 supported categories. */
export enum AuditCategory {
  AUTHENTICATION = "AUTHENTICATION",
  WORKSPACE = "WORKSPACE",
  CRM = "CRM",
  COMMUNICATION = "COMMUNICATION",
  BILLING = "BILLING",
  SETTINGS = "SETTINGS",
  INTEGRATIONS = "INTEGRATIONS",
}

export enum AuditResult {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
}

/**
 * PRD-006 Volume-4 §4.1 — workspace-scoped, immutable (BR-001/BR-002).
 * Populated by `AuditLogListener` reacting to a curated set of existing
 * domain events (never a new business-event source of its own, per §8's
 * "no duplicate persistence" rule) — see
 * docs/ADR-SET-007-audit-strategy.md for exactly which events are covered
 * and why. The AUTHENTICATION category is deliberately NOT written here at
 * all — Identity's own `LoginHistoryEntry` already is that audit trail;
 * `AuditLogService` composes it in at read time via
 * `AuthService.getWorkspaceLoginHistory()` instead of a second, duplicate
 * persisted copy.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "audit_log_entries" })
export class AuditLogEntry {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, enum: AuditCategory, required: true, index: true })
  category!: AuditCategory;

  // null for system-initiated events (e.g. a scheduled sweep), never for a
  // user-initiated action.
  @Prop({ type: String, default: null })
  actorId!: string | null;

  @Prop({ type: String, required: true })
  module!: string;

  @Prop({ type: String, default: null })
  entity!: string | null;

  @Prop({ type: String, default: null })
  entityId!: string | null;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String, enum: AuditResult, required: true, default: AuditResult.SUCCESS })
  result!: AuditResult;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  // §6 — secrets must never appear here; every listener that writes an
  // entry is responsible for passing only non-sensitive fields (never a
  // raw event payload dump).
  @Prop({ type: SchemaTypes.Mixed, default: null })
  metadata!: Record<string, unknown> | null;

  createdAt!: Date;
}

export const AuditLogEntrySchema = SchemaFactory.createForClass(AuditLogEntry);
AuditLogEntrySchema.index({ workspaceId: 1, createdAt: -1 });
