"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Theme, UiDensity } from "@wapp/shared-types";
import { Alert, PreferenceCard, Select, SettingsSection, SkeletonCard, Switch } from "@wapp/ui";
import { userPreferencesService } from "../../services/user-preferences.service";
import { syncDensity, syncSidebar, syncTheme } from "../../lib/preference-sync";
import { useThemeStore } from "../../stores/theme-store";
import { useUiStore } from "../../stores/ui-store";
import { ApiError } from "../../lib/api";
import type { UserNotificationPreferencesSummary } from "../../types/settings";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const TIME_FORMATS = ["12h", "24h"] as const;
const LANDING_PAGES = ["CRM", "INBOX", "DASHBOARD", "REPORTS"] as const;

const NOTIFICATION_EVENT_LABELS: Record<keyof UserNotificationPreferencesSummary, string> = {
  newAssignment: "New Assignment",
  newLead: "New Lead",
  dealWon: "Deal Won",
  mention: "Mention",
  taskReminder: "Task Reminder",
  followUpReminder: "Follow-up Reminder",
  billingReminder: "Billing Reminder",
};

/**
 * FRD-001 Volume-7 §4.4/§4.5 — self-scoped (`settings/user/*`, no
 * permission gate, every role manages their own preferences). Theme/
 * Sidebar/Density write through both the local Zustand store (immediate
 * UI feedback) and the backend (`lib/preference-sync.ts`) — migrated off
 * localStorage-only per the Architect's approval, 2026-08-12. Date/Time
 * Format show the backend-resolved `EffectiveFormatSummary` (`value` +
 * `source: "USER"|"WORKSPACE"`) so the user can see whether their own
 * override or the workspace default is currently in effect, without this
 * screen re-deriving that itself.
 */
export function PreferencesView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const [error, setError] = React.useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["settings", "user"],
    queryFn: () => userPreferencesService.overview(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings", "user"] });

  const handleThemeChange = (next: Theme) => {
    setTheme(next);
    syncTheme(next);
  };

  const handleSidebarChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    syncSidebar(collapsed);
  };

  const handleDensityChange = (next: UiDensity) => {
    setDensity(next);
    syncDensity(next);
  };

  const handleDateFormatChange = async (value: string) => {
    setError(null);
    try {
      await userPreferencesService.updatePreferences({ dateFormat: value || null });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update date format.");
    }
  };

  const handleTimeFormatChange = async (value: string) => {
    setError(null);
    try {
      await userPreferencesService.updatePreferences({ timeFormat: value || null });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update time format.");
    }
  };

  const handleLandingPageChange = async (value: string) => {
    setError(null);
    try {
      await userPreferencesService.updateDashboard({ defaultLandingPage: value || null });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update landing page.");
    }
  };

  const handleNotificationToggle = async (
    event: keyof UserNotificationPreferencesSummary,
    channel: "inApp" | "email",
    value: boolean,
  ) => {
    setError(null);
    try {
      await userPreferencesService.updateNotifications({
        notifications: { [event]: { [channel]: value } },
      });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update notification preference.");
    }
  };

  if (overviewQuery.isLoading || !overviewQuery.data) {
    return <SkeletonCard />;
  }

  const overview = overviewQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <SettingsSection title="Appearance">
        <PreferenceCard
          label="Theme"
          control={
            <Select
              aria-label="Theme"
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as Theme)}
            >
              <option value={Theme.LIGHT}>Light</option>
              <option value={Theme.DARK}>Dark</option>
              <option value={Theme.SYSTEM}>System</option>
            </Select>
          }
        />
        <PreferenceCard
          label="Sidebar collapsed"
          control={
            <Switch
              checked={sidebarCollapsed}
              onCheckedChange={handleSidebarChange}
              aria-label="Sidebar collapsed"
            />
          }
        />
        <PreferenceCard
          label="Density"
          control={
            <Select
              aria-label="Density"
              value={density}
              onChange={(e) => handleDensityChange(e.target.value as UiDensity)}
            >
              <option value={UiDensity.COMFORTABLE}>Comfortable</option>
              <option value={UiDensity.COMPACT}>Compact</option>
            </Select>
          }
        />
        <PreferenceCard
          label="Default landing page"
          control={
            <Select
              aria-label="Default landing page"
              value={overview.defaultLandingPage ?? ""}
              onChange={(e) => void handleLandingPageChange(e.target.value)}
            >
              <option value="">None (use Dashboard)</option>
              {LANDING_PAGES.map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </Select>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Date &amp; Time Format"
        description="Overrides the workspace default for your account only"
      >
        <PreferenceCard
          label="Date format"
          description={`Currently: ${overview.dateFormat.value} (${overview.dateFormat.source === "USER" ? "your override" : "workspace default"})`}
          control={
            <Select
              aria-label="Date format override"
              defaultValue={overview.dateFormat.source === "USER" ? overview.dateFormat.value : ""}
              onChange={(e) => void handleDateFormatChange(e.target.value)}
            >
              <option value="">Inherit workspace default</option>
              {DATE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </Select>
          }
        />
        <PreferenceCard
          label="Time format"
          description={`Currently: ${overview.timeFormat.value} (${overview.timeFormat.source === "USER" ? "your override" : "workspace default"})`}
          control={
            <Select
              aria-label="Time format override"
              defaultValue={overview.timeFormat.source === "USER" ? overview.timeFormat.value : ""}
              onChange={(e) => void handleTimeFormatChange(e.target.value)}
            >
              <option value="">Inherit workspace default</option>
              {TIME_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </Select>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Personal, per-event notification preferences"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-caption text-neutral-500 dark:text-neutral-400">
                <th className="pb-2 font-medium">Event</th>
                <th className="pb-2 font-medium">In-App</th>
                <th className="pb-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {(
                Object.keys(NOTIFICATION_EVENT_LABELS) as Array<
                  keyof UserNotificationPreferencesSummary
                >
              ).map((event) => (
                <tr key={event} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="text-body-sm py-2 text-neutral-900 dark:text-neutral-50">
                    {NOTIFICATION_EVENT_LABELS[event]}
                  </td>
                  <td className="py-2">
                    <Switch
                      checked={overview.notifications[event].inApp}
                      onCheckedChange={(value) =>
                        void handleNotificationToggle(event, "inApp", value)
                      }
                      aria-label={`${NOTIFICATION_EVENT_LABELS[event]} in-app`}
                    />
                  </td>
                  <td className="py-2">
                    <Switch
                      checked={overview.notifications[event].email}
                      onCheckedChange={(value) =>
                        void handleNotificationToggle(event, "email", value)
                      }
                      aria-label={`${NOTIFICATION_EVENT_LABELS[event]} email`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
  );
}
