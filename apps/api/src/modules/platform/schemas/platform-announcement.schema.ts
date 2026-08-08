import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PlatformAnnouncementDocument = HydratedDocument<PlatformAnnouncement>;

/** §4.4 — All Workspaces / Selected Plans / Selected Workspaces. */
export enum AnnouncementTargetType {
  ALL = "ALL",
  PLANS = "PLANS",
  WORKSPACES = "WORKSPACES",
}

/**
 * PRD-007 Volume-1 §4.4 — platform-owned, no `workspaceId` (this is not a
 * tenant-scoped collection). §10: message capped at 5000 characters.
 * Creation + platform-side listing only this volume — no tenant-facing
 * display endpoint exists in §9's literal API surface.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "platform_announcements" })
export class PlatformAnnouncement {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, maxlength: 5000 })
  message!: string;

  @Prop({ type: String, enum: AnnouncementTargetType, required: true })
  targetType!: AnnouncementTargetType;

  @Prop({ type: [String], default: [] })
  targetPlanIds!: string[];

  @Prop({ type: [String], default: [] })
  targetWorkspaceIds!: string[];

  @Prop({ required: true })
  createdBy!: string;

  createdAt!: Date;
}

export const PlatformAnnouncementSchema = SchemaFactory.createForClass(PlatformAnnouncement);
