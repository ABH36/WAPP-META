import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SupportSessionDocument = HydratedDocument<SupportSession>;

/** §4.2. */
export enum SupportSessionStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  TERMINATED = "TERMINATED",
}

/** §10 — a single request cannot ask for more than 4 hours of access. */
export const SUPPORT_SESSION_MAX_DURATION_MINUTES = 240;

/**
 * PRD-007 Volume-3 §4.1/§4.2 — the request and the session it becomes are
 * the same record (§9's `/access/request` → `/access/:id/approve` →
 * `/sessions/:id/start` → `/sessions/:id/end` routes all address one id
 * moving through `SupportSessionStatus`), not two separate collections.
 * Deliberately distinct from `PlatformSession` (a platform staff member's
 * own login session) — a completely different concept that happens to
 * share the word "session"; never conflate the two. See
 * docs/ADR-PLAT-005-platform-support-break-glass-boundary.md.
 */
@Schema({ timestamps: true, collection: "support_sessions" })
export class SupportSession {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true })
  requestedBy!: string;

  @Prop({ type: String, default: null })
  approvedBy!: string | null;

  @Prop({ type: String, required: true })
  reason!: string;

  @Prop({ type: Number, required: true })
  durationMinutes!: number;

  @Prop({ type: String, enum: SupportSessionStatus, required: true, index: true })
  status!: SupportSessionStatus;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;

  // Who actually holds live cross-tenant read access for this session —
  // not necessarily `requestedBy` (a Support role can request; only a
  // PLATFORM_SUPER_ADMIN can start, and that may be a different person).
  // Every gated read is checked against this field, never `requestedBy`.
  @Prop({ type: String, default: null })
  startedBy!: string | null;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  // Only ever set once the session actually starts (not at request time) —
  // a request can sit pending approval indefinitely without burning down
  // its own access window.
  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({ type: Date, default: null })
  endedAt!: Date | null;

  @Prop({ type: String, default: null })
  terminationReason!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SupportSessionSchema = SchemaFactory.createForClass(SupportSession);
