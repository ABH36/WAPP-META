import type { SidebarState, Theme, UiDensity } from "@wapp/shared-types";
import { apiGet, apiPatch } from "../lib/api";
import type { UserSettingsOverview } from "../types/settings";

export interface UpdateUserPreferencesPayload {
  dateFormat?: string | null;
  timeFormat?: string | null;
}

export interface UpdateThemePayload {
  theme?: Theme;
  sidebar?: SidebarState;
  density?: UiDensity;
}

export interface UpdateDashboardPreferencesPayload {
  defaultLandingPage?: string | null;
  pinnedPages?: string[];
  favoriteModules?: string[];
}

export interface NotificationChannelPayload {
  inApp?: boolean;
  email?: boolean;
}

export interface UpdateNotificationsPayload {
  notifications: {
    newAssignment?: NotificationChannelPayload;
    newLead?: NotificationChannelPayload;
    dealWon?: NotificationChannelPayload;
    mention?: NotificationChannelPayload;
    taskReminder?: NotificationChannelPayload;
    followUpReminder?: NotificationChannelPayload;
    billingReminder?: NotificationChannelPayload;
  };
}

/**
 * FRD-001 Volume-7 §4.4/§4.5 — self-scoped (`settings/user/*`, authentication
 * only, no permission gate — every user manages their own preferences).
 * `updateTheme` is also the route `lib/preference-sync.ts` uses to migrate
 * Theme/Sidebar/Density off the old localStorage-only stores onto real
 * backend persistence (Architecture Review, 2026-08-12).
 */
export const userPreferencesService = {
  overview(): Promise<UserSettingsOverview> {
    return apiGet("/settings/user");
  },

  updatePreferences(payload: UpdateUserPreferencesPayload): Promise<UserSettingsOverview> {
    return apiPatch("/settings/user/preferences", payload);
  },

  updateTheme(payload: UpdateThemePayload): Promise<UserSettingsOverview> {
    return apiPatch("/settings/user/theme", payload);
  },

  updateDashboard(payload: UpdateDashboardPreferencesPayload): Promise<UserSettingsOverview> {
    return apiPatch("/settings/user/dashboard", payload);
  },

  updateNotifications(payload: UpdateNotificationsPayload): Promise<UserSettingsOverview> {
    return apiPatch("/settings/user/notifications", payload);
  },
};
