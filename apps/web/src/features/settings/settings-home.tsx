"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { SettingsSection, SkeletonCard, SummaryCard } from "@wapp/ui";
import { settingsService } from "../../services/settings.service";
import { workspaceService } from "../../services/workspace.service";
import { userPreferencesService } from "../../services/user-preferences.service";
import { useHasPermission } from "../../lib/permissions";

const EXISTING_LINKS = [
  { href: "/workspace/profile", label: "Workspace Settings", requiresEditWorkspace: true },
  { href: "/workspace/branding", label: "Branding", requiresEditWorkspace: true },
  {
    href: "/workspace/notifications",
    label: "Workspace Notifications",
    requiresEditWorkspace: true,
  },
  { href: "/profile/security", label: "Change Password", requiresEditWorkspace: false },
  { href: "/profile/sessions", label: "Active Sessions", requiresEditWorkspace: false },
  { href: "/profile/login-history", label: "Login History", requiresEditWorkspace: false },
] as const;

const NEW_LINKS = [
  { href: "/settings/preferences", label: "Preferences", requires: null },
  { href: "/settings/integrations", label: "Integrations", requires: Permission.EDIT_WORKSPACE },
  { href: "/settings/api-keys", label: "API Keys", requires: Permission.EDIT_WORKSPACE },
  { href: "/settings/webhooks", label: "Webhooks", requires: Permission.EDIT_WORKSPACE },
  { href: "/settings/audit", label: "Audit Logs", requires: Permission.EDIT_WORKSPACE },
  { href: "/settings/export", label: "Data Export", requires: Permission.EDIT_WORKSPACE },
  { href: "/settings/diagnostics", label: "Diagnostics", requires: Permission.VIEW_REPORTS },
] as const;

/**
 * FRD-001 Volume-7 §4.1 — a navigation hub, not a rebuild (Architecture
 * Review, 2026-08-12: "Settings Home becomes a navigation hub rather than
 * a duplicate implementation"). Workspace Settings/Branding/Notifications/
 * Security stay exactly where FRD-001 Volume-2/Volume-3 already shipped
 * them — this page only composes read-only summaries (via the same
 * `settingsService.overview()`/`workspaceService.current()` reads those
 * pages already use) plus Quick Links to both the existing and the
 * genuinely new Volume-7 sections. No forms, no writes.
 *
 * `GET /settings` (branding/currency) is `EDIT_WORKSPACE`-gated, not just
 * its writes (the same finding FRD-001 Volume-3 made for the Branding/
 * Preferences tabs) — its query is conditionally enabled and those two
 * cards render only for `EDIT_WORKSPACE` holders, hidden entirely rather
 * than erroring, matching every prior volume's permission pattern.
 * `GET /workspaces/me` (name/language/timezone) is the broader
 * `VIEW_WORKSPACE`, safe for every role.
 */
export function SettingsHome(): React.JSX.Element {
  const canEditWorkspace = useHasPermission(Permission.EDIT_WORKSPACE);
  const canViewReports = useHasPermission(Permission.VIEW_REPORTS);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", "current"],
    queryFn: () => workspaceService.current(),
  });
  const settingsQuery = useQuery({
    queryKey: ["settings", "overview"],
    queryFn: () => settingsService.overview(),
    enabled: canEditWorkspace,
  });
  const userPrefsQuery = useQuery({
    queryKey: ["settings", "user"],
    queryFn: () => userPreferencesService.overview(),
  });
  const historyQuery = useQuery({
    queryKey: ["settings", "config-history"],
    queryFn: () => settingsService.configHistory(1, 5),
    enabled: canEditWorkspace,
  });

  const isLoading = workspaceQuery.isLoading || userPrefsQuery.isLoading;

  return (
    <div className="flex flex-col gap-6">
      {isLoading || !workspaceQuery.data || !userPrefsQuery.data ? (
        <SkeletonCard />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Workspace Name" value={workspaceQuery.data.name} />
          <SummaryCard label="Current Theme" value={userPrefsQuery.data.theme} />
          <SummaryCard label="Language" value={workspaceQuery.data.language} />
          <SummaryCard label="Timezone" value={workspaceQuery.data.businessHours.timezone} />
          {canEditWorkspace && settingsQuery.data ? (
            <>
              <SummaryCard label="Currency" value={settingsQuery.data.preferences.currency} />
              <SummaryCard
                label="Branding"
                value={
                  settingsQuery.data.branding.logoUrl ? (
                    <div className="relative h-8 w-24">
                      <Image
                        src={settingsQuery.data.branding.logoUrl}
                        alt="Workspace logo"
                        fill
                        sizes="96px"
                        className="object-contain object-left"
                      />
                    </div>
                  ) : (
                    "No logo set"
                  )
                }
              />
            </>
          ) : null}
        </div>
      )}

      <SettingsSection
        title="Quick Links"
        description="Workspace and account settings already available today"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {EXISTING_LINKS.filter((link) => !link.requiresEditWorkspace || canEditWorkspace).map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-body-sm text-brand-600 hover:underline"
              >
                {link.label} →
              </Link>
            ),
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="More Settings" description="New in this volume">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {NEW_LINKS.filter(
            (link) =>
              !link.requires ||
              (link.requires === Permission.EDIT_WORKSPACE && canEditWorkspace) ||
              (link.requires === Permission.VIEW_REPORTS && canViewReports),
          ).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body-sm text-brand-600 hover:underline"
            >
              {link.label} →
            </Link>
          ))}
        </div>
      </SettingsSection>

      {canEditWorkspace ? (
        <SettingsSection
          title="Recent Configuration Changes"
          description="The last 5 changes across Settings"
        >
          {historyQuery.isLoading ? (
            <SkeletonCard />
          ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-body-sm text-neutral-500 dark:text-neutral-400">
              No recent changes.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historyQuery.data?.items.map((entry) => (
                <li
                  key={entry.id}
                  className="text-body-sm flex items-center justify-between gap-2 text-neutral-700 dark:text-neutral-300"
                >
                  <span>{entry.area}</span>
                  <span className="text-caption text-neutral-500 dark:text-neutral-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      ) : null}
    </div>
  );
}
