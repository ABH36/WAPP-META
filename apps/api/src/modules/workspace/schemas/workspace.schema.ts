import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { WorkspaceStatus } from "@wapp/shared-types";

export type WorkspaceDocument = HydratedDocument<Workspace>;

// `@Schema()` is required here, not just on the root `Workspace` class below
// — without it, `@nestjs/mongoose` never registers these `@Prop()` fields,
// and Mongoose silently persists an empty embedded object (only its
// auto-generated `_id`). Caught by reading a created document back from
// Mongo directly, not by typecheck/lint/build/unit tests (mocked
// repositories don't exercise real Mongoose schema compilation).
@Schema({ _id: false })
export class BusinessProfile {
  @Prop({ type: String, default: null })
  category!: string | null;

  @Prop({ type: String, default: null })
  description!: string | null;

  // ADR-026 — optional. No GSTIN -> Non-GST invoice; GSTIN provided -> GST
  // invoice. Format validated at the DTO layer (matches
  // packages/shared-validation's gstinSchema), stored uppercase.
  @Prop({ type: String, default: null })
  gstin!: string | null;
}
export const BusinessProfileSchema = SchemaFactory.createForClass(BusinessProfile);

@Schema({ _id: true })
export class BusinessHoursDay {
  // 0 = Sunday .. 6 = Saturday.
  @Prop({ required: true, min: 0, max: 6 })
  dayOfWeek!: number;

  @Prop({ default: true })
  isOpen!: boolean;

  // "HH:mm", 24-hour, workspace-local (per `timezone` below). Only
  // meaningful when isOpen is true.
  @Prop({ type: String, default: "09:00" })
  openTime!: string;

  @Prop({ type: String, default: "18:00" })
  closeTime!: string;
}
export const BusinessHoursDaySchema = SchemaFactory.createForClass(BusinessHoursDay);

@Schema({ _id: true })
export class PublicHoliday {
  // ISO date (YYYY-MM-DD) — manually configured (ADR-028), no holiday-calendar sync in Phase-1.
  @Prop({ required: true })
  date!: string;

  @Prop({ required: true, trim: true })
  name!: string;
}
export const PublicHolidaySchema = SchemaFactory.createForClass(PublicHoliday);

@Schema({ _id: false })
export class BusinessHours {
  // IANA timezone name (e.g. "Asia/Kolkata") — every openTime/closeTime above is
  // interpreted in this zone.
  @Prop({ type: String, default: "Asia/Kolkata" })
  timezone!: string;

  @Prop({ type: [BusinessHoursDaySchema], default: [] })
  schedule!: BusinessHoursDay[];

  @Prop({ type: [PublicHolidaySchema], default: [] })
  publicHolidays!: PublicHoliday[];
}
export const BusinessHoursSchema = SchemaFactory.createForClass(BusinessHours);

/**
 * User-configurable notification toggles only (ADR-029). System
 * notifications (Quality Rating Changed, Webhook Failure, Meta Connection
 * Lost, Workspace Suspended, Billing Failure, SLA Breach, Security Alert)
 * are platform-controlled and cannot be disabled — they are intentionally
 * NOT modeled here as settings, since there is nothing to toggle.
 */
@Schema({ _id: false })
export class NotificationSettings {
  @Prop({ default: true })
  taskFollowUpReminder!: boolean;

  @Prop({ default: true })
  conversationLeadAssignment!: boolean;

  @Prop({ default: true })
  broadcastCompleted!: boolean;

  @Prop({ default: true })
  subscriptionReminder!: boolean;
}
export const NotificationSettingsSchema = SchemaFactory.createForClass(NotificationSettings);

/**
 * Traces to: PRD-002 v1.1 (Tenant = Workspace, same entity in Phase-1 —
 * modeled as a 1:1 relationship that can become 1:many later, not merged
 * permanently), PRD-005/ADR-017 (Workspace Status), PRD-006 v1.1 (Business
 * Profile/Hours/Notifications/Language — ADR-026/027/028/029/030), D007
 * (14-day trial).
 *
 * This is the tenant root — it deliberately has no `workspaceId` of its own
 * (it IS the isolation boundary every `TenantOwnedEntity` collection points
 * back to via `workspaceId`, per SAD-002 §5/§6).
 */
@Schema({ timestamps: true, collection: "workspaces" })
export class Workspace {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: BusinessProfileSchema, default: () => ({}) })
  businessProfile!: BusinessProfile;

  @Prop({ type: BusinessHoursSchema, default: () => ({}) })
  businessHours!: BusinessHours;

  @Prop({ type: NotificationSettingsSchema, default: () => ({}) })
  notificationSettings!: NotificationSettings;

  // ADR-027 — English-only, hardcoded, no selector in Phase-1. Field exists
  // so Phase-2 (Hindi/Gujarati/Marathi/Tamil/Telugu/Kannada/Malayalam) is an
  // additive change, not a schema migration.
  @Prop({ type: String, default: "en" })
  language!: string;

  @Prop({ type: String, enum: WorkspaceStatus, default: WorkspaceStatus.TRIAL })
  status!: WorkspaceStatus;

  // TRIAL-BR-002 — trial clock starts at Workspace creation, not registration.
  // D007 — 14 days, no credit card.
  @Prop({ required: true })
  trialEndsAt!: Date;

  @Prop({ type: String, default: null })
  createdBy!: string | null;

  @Prop({ type: String, default: null })
  updatedBy!: string | null;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  @Prop({ type: String, default: null })
  deletedBy!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
