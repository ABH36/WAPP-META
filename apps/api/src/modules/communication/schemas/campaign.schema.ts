import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type CampaignDocument = HydratedDocument<Campaign>;

/**
 * No DRAFT state — a Campaign is only ever created with at least one wave
 * that already has a `scheduledAt` (see CreateCampaignWaveDto), so it has
 * real scheduled work from the moment it exists. See
 * docs/COMM-CAMPAIGN-LIFECYCLE.md.
 */
export enum CampaignStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/**
 * Traces to: PRD-003 Part 3 (Campaign Management), confirmed richer than
 * Broadcast via "segmentation, scheduling, monitoring, analytics" — resolved
 * 2026-08-05 (Product Owner decision, since CRM segmentation still doesn't
 * exist) as: a Campaign is a container orchestrating multiple Broadcasts
 * ("waves") sent to the same audience over a timeline, not a segmentation
 * upgrade. A Campaign owns no send mechanics of its own — every wave is a
 * real `Broadcast` document (`Broadcast.campaignId` back-reference), reusing
 * 100% of Broadcast's existing lifecycle/execution/recipient-tracking
 * infrastructure. See docs/COMM-CAMPAIGN-LIFECYCLE.md.
 */
@Schema({ timestamps: true, collection: "campaigns" })
export class Campaign {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "PhoneNumber", required: true })
  phoneNumberId!: Types.ObjectId;

  // Shared audience for every wave — one Campaign, one target list (the
  // same explicit-Contact-list model Broadcast uses; see ADR scoping note
  // in docs/COMM-BROADCAST-LIFECYCLE.md, carried forward unchanged here).
  @Prop({ type: [String], required: true, default: [] })
  targetContactIds!: string[];

  @Prop({ type: String, enum: CampaignStatus, required: true, default: CampaignStatus.ACTIVE })
  status!: CampaignStatus;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
