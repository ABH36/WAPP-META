import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { SidebarState, Theme, UiDensity } from "@wapp/shared-types";

export type UserPreferencesDocument = HydratedDocument<UserPreferences>;

/** §4.4 — one entry per notification-worthy event, In-App/Email only (Browser/Mobile Push are §4.4 "Future"). Both default true, matching the same opt-out (not opt-in) default already established by Workspace's own notificationSettings. */
@Schema({ _id: false })
export class NotificationEventPreference {
  @Prop({ default: true })
  inApp!: boolean;

  @Prop({ default: true })
  email!: boolean;
}
export const NotificationEventPreferenceSchema = SchemaFactory.createForClass(
  NotificationEventPreference,
);

@Schema({ _id: false })
export class UserNotificationPreferences {
  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  newAssignment!: NotificationEventPreference;

  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  newLead!: NotificationEventPreference;

  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  dealWon!: NotificationEventPreference;

  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  mention!: NotificationEventPreference;

  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  taskReminder!: NotificationEventPreference;

  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  followUpReminder!: NotificationEventPreference;

  @Prop({ type: NotificationEventPreferenceSchema, default: () => ({}) })
  billingReminder!: NotificationEventPreference;
}
export const UserNotificationPreferencesSchema = SchemaFactory.createForClass(
  UserNotificationPreferences,
);

/**
 * Traces to: PRD-006 Volume-2 §3/§4 (User Preferences — Settings-owned,
 * personal, never shared across Workspace members, BR-001). Keyed by
 * `userId` only, not `workspaceId` — these are attributes of the user, the
 * same platform-global-identity reasoning `User` itself already uses (a
 * user in Phase-1 has exactly one Workspace, but preferences are still
 * modeled as belonging to the person, not the membership).
 *
 * `dateFormat`/`timeFormat` are nullable **overrides** of
 * `WorkspaceSettings.dateFormat`/`timeFormat` (Volume-1) — null means
 * "inherit the Workspace default." Resolved 2026-08-07, Architecture
 * Review: personal override model, not a duplicate concept — see
 * docs/ADR-SET-003-personal-preference-resolution-strategy.md.
 */
@Schema({ timestamps: true, collection: "user_preferences" })
export class UserPreferences {
  @Prop({ type: String, required: true, unique: true })
  userId!: string;

  @Prop({ type: String, enum: Theme, required: true, default: Theme.SYSTEM })
  theme!: Theme;

  @Prop({ type: String, enum: SidebarState, required: true, default: SidebarState.EXPANDED })
  sidebar!: SidebarState;

  @Prop({ type: String, enum: UiDensity, required: true, default: UiDensity.COMFORTABLE })
  density!: UiDensity;

  @Prop({ type: String, default: null })
  dateFormat!: string | null;

  @Prop({ type: String, default: null })
  timeFormat!: string | null;

  @Prop({ type: String, default: null })
  defaultLandingPage!: string | null;

  @Prop({ type: [String], default: [] })
  pinnedPages!: string[];

  @Prop({ type: [String], default: [] })
  favoriteModules!: string[];

  @Prop({ type: UserNotificationPreferencesSchema, default: () => ({}) })
  notifications!: UserNotificationPreferences;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);
