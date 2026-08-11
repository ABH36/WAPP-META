import type { BusinessHours, BusinessProfile, WorkspaceNotificationSettings } from "./workspace";

/** FRD-001 Volume-3 §4.4 — mirrors `apps/api`'s `SettingsOverview.branding`. Logo is the entirety of Branding today (ADR-SET-002) — no colors/theme fields exist. */
export interface SettingsBranding {
  logoUrl: string | null;
}

/** FRD-001 Volume-3 §4.5 — mirrors `apps/api`'s `SettingsOverview.preferences`. These are workspace *defaults*; a user's own Profile settings (FRD-001 Volume-2) may override `dateFormat`/`timeFormat` individually (ADR-SET-003). */
export interface SettingsPreferences {
  currency: string;
  dateFormat: string;
  timeFormat: string;
}

/**
 * FRD-001 Volume-3 §4.2/§4.3/§4.4/§4.5/§4.6 — mirrors `apps/api`'s
 * `SettingsOverview` (`settings.types.ts`) field-for-field. This is the
 * single read every `/workspace/*` management page uses (`GET /settings`)
 * — `businessProfile`/`businessHours`/`notificationSettings`/`language`
 * are Settings' read-only composition of the Workspace module's own data
 * (ADR-SET-001); only `branding`/`preferences` are actually owned/written
 * by Settings.
 */
export interface SettingsOverview {
  workspaceId: string;
  businessProfile: BusinessProfile;
  businessHours: BusinessHours;
  notificationSettings: WorkspaceNotificationSettings;
  language: string;
  branding: SettingsBranding;
  preferences: SettingsPreferences;
}

/** FRD-001 Volume-3 §4.4 — mirrors `apps/api`'s `LogoUploadSignature`. A Cloudinary direct-upload signature (SEC-016) — file bytes never touch the API. */
export interface LogoUploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}
