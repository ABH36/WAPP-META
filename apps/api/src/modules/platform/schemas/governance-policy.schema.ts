import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";

export type GovernancePolicyDocument = HydratedDocument<GovernancePolicy>;

/**
 * PRD-007 Volume-4 §4.3/§4.6 — Architecture Review, 2026-08-10: "Governance
 * Policies and Global Configuration are merged into a single Governance
 * Policy subsystem. A separate Global Configuration collection and API
 * surface will not be created." One document per key; every key covers
 * exactly one of §4.3's original policies plus §4.6's genuinely-distinct
 * items (Platform Limits, Default Retention) folded in as additional keys.
 * "Break-Glass Duration" is deliberately absent — ADR-PLAT-005's
 * SUPPORT_SESSION_MAX_DURATION_MINUTES stays a fixed constant, not a
 * policy. See docs/ADR-PLAT-007-platform-governance-strategy.md.
 */
export enum GovernancePolicyKey {
  PASSWORD_POLICY = "PASSWORD_POLICY",
  SESSION_TIMEOUT = "SESSION_TIMEOUT",
  PLATFORM_MAINTENANCE_DEFAULTS = "PLATFORM_MAINTENANCE_DEFAULTS",
  PLATFORM_LOGIN_POLICY = "PLATFORM_LOGIN_POLICY",
  PLATFORM_LIMITS = "PLATFORM_LIMITS",
  DEFAULT_RETENTION = "DEFAULT_RETENTION",
}

/**
 * §10 — "Configuration Changes Require version increment." One subdocument
 * per prior value, pushed onto `history` before every overwrite — the
 * document's own `history` array is a convenience for quick access;
 * `PlatformAuditEntry` (via PLATFORM_POLICY_UPDATED) remains the canonical,
 * immutable audit trail (BR-004), same as every other Volume-3/4 audited
 * action.
 */
@Schema({ _id: false })
export class GovernancePolicyHistoryEntry {
  @Prop({ type: SchemaTypes.Mixed, required: true })
  value!: Record<string, unknown>;

  @Prop({ type: Number, required: true })
  version!: number;

  @Prop({ type: String, required: true })
  reason!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

const GovernancePolicyHistoryEntrySchema = SchemaFactory.createForClass(
  GovernancePolicyHistoryEntry,
);

@Schema({ timestamps: true, collection: "governance_policies" })
export class GovernancePolicy {
  @Prop({ type: String, enum: GovernancePolicyKey, required: true, unique: true })
  key!: GovernancePolicyKey;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  value!: Record<string, unknown>;

  /** Starts at 1 on first PATCH (this collection is never seeded — BR-003, every value that exists has a real, admin-supplied justification behind it). */
  @Prop({ type: Number, required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  reason!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  @Prop({ type: [GovernancePolicyHistoryEntrySchema], default: [] })
  history!: GovernancePolicyHistoryEntry[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const GovernancePolicySchema = SchemaFactory.createForClass(GovernancePolicy);
