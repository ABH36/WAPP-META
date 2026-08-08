import type { SidebarState, Theme, UiDensity } from "@wapp/shared-types";

export interface LogoUploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * §2 — the "unified configuration experience." Orchestrated fields
 * (businessProfile/businessHours/notificationSettings/language) are read
 * straight from Workspace, never duplicated or cached here; Settings only
 * owns branding/preferences. Writes to the orchestrated fields go through
 * Workspace's own existing endpoints unchanged — this type is read-only
 * composition, not a parallel write path. See
 * docs/ADR-SET-001-settings-ownership-strategy.md.
 */
export interface SettingsOverview {
  workspaceId: string;
  businessProfile: {
    category: string | null;
    description: string | null;
    gstin: string | null;
  };
  businessHours: {
    timezone: string;
    schedule: Array<{
      dayOfWeek: number;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    }>;
    publicHolidays: Array<{ date: string; name: string }>;
  };
  notificationSettings: {
    taskFollowUpReminder: boolean;
    conversationLeadAssignment: boolean;
    broadcastCompleted: boolean;
    subscriptionReminder: boolean;
  };
  // Read-only in Volume-1 — no selector endpoint exists yet (ADR-027,
  // TD-017: full localization deferred to a dedicated initiative).
  language: string;
  branding: {
    logoUrl: string | null;
  };
  preferences: {
    currency: string;
    dateFormat: string;
    timeFormat: string;
  };
}

export interface NotificationEventPreferenceSummary {
  inApp: boolean;
  email: boolean;
}

export interface UserNotificationPreferencesSummary {
  newAssignment: NotificationEventPreferenceSummary;
  newLead: NotificationEventPreferenceSummary;
  dealWon: NotificationEventPreferenceSummary;
  mention: NotificationEventPreferenceSummary;
  taskReminder: NotificationEventPreferenceSummary;
  followUpReminder: NotificationEventPreferenceSummary;
  billingReminder: NotificationEventPreferenceSummary;
}

/**
 * §4.2 / ADR-SET-003 — the resolved value after applying the User Override
 * -> Workspace Default precedence. `source` tells the caller which one won,
 * without them having to re-derive it client-side.
 */
export interface EffectiveFormatSummary {
  value: string;
  source: "USER" | "WORKSPACE";
}

/**
 * PRD-006 Volume-2 §2/§3. `dateFormat`/`timeFormat` are the *effective*
 * (already-resolved) values; `timezone` stays read-only, inherited
 * straight from Workspace (§4.2 — "Read only. Inherited from Workspace"),
 * unchanged from Volume-1.
 */
export interface UserSettingsOverview {
  userId: string;
  theme: Theme;
  sidebar: SidebarState;
  density: UiDensity;
  dateFormat: EffectiveFormatSummary;
  timeFormat: EffectiveFormatSummary;
  timezone: string;
  defaultLandingPage: string | null;
  pinnedPages: string[];
  favoriteModules: string[];
  notifications: UserNotificationPreferencesSummary;
}
