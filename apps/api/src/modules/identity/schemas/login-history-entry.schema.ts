import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type LoginHistoryEntryDocument = HydratedDocument<LoginHistoryEntry>;

/**
 * Traces to: PRD-006 Volume-2 §4.7/BR-007 (Login History — read-only,
 * immutable). New capability added to Identity (frozen, Phase-2) —
 * resolved 2026-08-07, Architecture Review: authorized as part of Volume-2,
 * since Settings must never own this data (§11) and no equivalent
 * audit log existed before (`User.failedLoginAttempts`/`lockedUntil` only
 * support lockout, they aren't a queryable history). One entry per login
 * attempt, successful or not — written by `AuthService.login()` at every
 * terminal branch for a *known* user (an unknown email has no userId to
 * key an entry by). Insert-only — no update/delete method exists on
 * `LoginHistoryRepository` by design, matching this codebase's established
 * immutable-log pattern (Billing History, Usage History). See
 * docs/ADR-SET-004-identity-orchestration-strategy.md.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "login_history" })
export class LoginHistoryEntry {
  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Boolean, required: true })
  success!: boolean;

  // Null on success — a short machine-readable code identifying why a login
  // attempt failed (e.g. "INVALID_CREDENTIALS", "ACCOUNT_LOCKED").
  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  createdAt!: Date;
}

export const LoginHistoryEntrySchema = SchemaFactory.createForClass(LoginHistoryEntry);
