import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type BroadcastDocument = HydratedDocument<Broadcast>;

/**
 * Traces to: PRD-003 Part 3 (Broadcast Management), confirmed 7-item status
 * list. No approval-gate status exists (BDC-009 — Broadcast Approval Flow
 * deferred to Future Phase, Phase-1 ships with no Phase-1 review gate, a
 * knowingly accepted risk).
 */
export enum BroadcastStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

/**
 * A one-time template send to an explicit, manually-assembled list of
 * Contacts (docs/COMM-BROADCAST-LIFECYCLE.md's "audience model" note — CRM
 * segmentation doesn't exist until Phase 5, so there's nothing richer to
 * target by yet; this is a deliberate scoping decision, not an oversight).
 * The actual per-recipient fan-out is tracked in the separate
 * `BroadcastRecipient` collection, not embedded here (a Broadcast could
 * target thousands of Contacts — an embedded array risks the 16MB Mongo
 * document limit and makes per-recipient status updates expensive writes
 * against a shared document).
 */
@Schema({ timestamps: true, collection: "broadcasts" })
export class Broadcast {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Template", required: true })
  templateId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: "PhoneNumber", required: true })
  phoneNumberId!: Types.ObjectId;

  // Set only when this Broadcast is one wave of a Campaign (Part 3b-ii) —
  // null for a standalone Broadcast. A Campaign owns no send mechanics of
  // its own; every wave is a real Broadcast, this is the back-reference.
  @Prop({ type: SchemaTypes.ObjectId, ref: "Campaign", default: null, index: true })
  campaignId!: Types.ObjectId | null;

  // Substituted into the template's BODY placeholders identically for every
  // recipient — no per-recipient personalization in this slice (Contact has
  // no reliable per-contact attributes beyond phoneNumber/waProfileName to
  // personalize with; see docs/COMM-BROADCAST-LIFECYCLE.md).
  @Prop({ type: [String], required: true, default: [] })
  bodyParameters!: string[];

  @Prop({ type: String, enum: BroadcastStatus, required: true, default: BroadcastStatus.DRAFT })
  status!: BroadcastStatus;

  @Prop({ type: Date, default: null })
  scheduledAt!: Date | null;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: String, default: null })
  failureReason!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BroadcastSchema = SchemaFactory.createForClass(Broadcast);

BroadcastSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
