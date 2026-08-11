"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Select, SkeletonText } from "@wapp/ui";
import { settingsService } from "../../services/settings.service";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const TIME_FORMATS = ["12h", "24h"] as const;

/**
 * FRD-001 Volume-3 §4.5 — edits only the workspace *default*
 * (`PATCH /settings/preferences`); a user's own Profile settings
 * (FRD-001 Volume-2) may override date/time format individually
 * (ADR-SET-003, Architecture Review 2026-08-10). Currency is rendered
 * strictly read-only — BR-007 ("Currency is display-only. Billing remains
 * INR-only") governs even though the backend DTO technically accepts a
 * write. Language is read-only (no update route exists anywhere, TD-017).
 * Theme has no workspace-level representation at all — it's purely
 * per-user, so this links into the existing Profile control instead of
 * introducing a duplicate.
 */
export function PreferencesForm(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [savingField, setSavingField] = React.useState<"dateFormat" | "timeFormat" | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings", "overview"],
    queryFn: () => settingsService.overview(),
    enabled: canEdit,
  });

  if (!canEdit) {
    return (
      <Alert variant="info">
        Only the workspace Owner or Administrator can view or change workspace preferences.
      </Alert>
    );
  }

  const handleChange = async (field: "dateFormat" | "timeFormat", value: string) => {
    setError(null);
    setSavingField(field);
    try {
      const updated = await settingsService.updatePreferences({ [field]: value });
      queryClient.setQueryData(["settings", "overview"], updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSavingField(null);
    }
  };

  if (settingsQuery.isLoading) {
    return <SkeletonText lines={5} />;
  }

  const preferences = settingsQuery.data?.preferences;
  const language = settingsQuery.data?.language;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Alert variant="info">
        These are workspace defaults. Workspace members can override date and time format for
        themselves in their own Profile settings.
      </Alert>

      <div className="max-w-xs">
        <p className="text-body-sm mb-1 font-medium text-neutral-700 dark:text-neutral-300">
          Currency
        </p>
        <p className="text-body text-neutral-900 dark:text-neutral-50">
          {preferences?.currency ?? "—"}
        </p>
        <p className="text-caption text-neutral-500 dark:text-neutral-400">
          Billing remains INR-only.
        </p>
      </div>

      <div className="max-w-xs">
        <label
          htmlFor="dateFormat"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Date format (workspace default)
        </label>
        <Select
          id="dateFormat"
          value={preferences?.dateFormat}
          disabled={savingField === "dateFormat"}
          onChange={(event) => void handleChange("dateFormat", event.target.value)}
        >
          {DATE_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </Select>
      </div>

      <div className="max-w-xs">
        <label
          htmlFor="timeFormat"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Time format (workspace default)
        </label>
        <Select
          id="timeFormat"
          value={preferences?.timeFormat}
          disabled={savingField === "timeFormat"}
          onChange={(event) => void handleChange("timeFormat", event.target.value)}
        >
          {TIME_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </Select>
      </div>

      <div className="max-w-xs">
        <p className="text-body-sm mb-1 font-medium text-neutral-700 dark:text-neutral-300">
          Language
        </p>
        <p className="text-body text-neutral-900 dark:text-neutral-50">{language ?? "—"}</p>
      </div>

      <div className="max-w-xs">
        <p className="text-body-sm mb-1 font-medium text-neutral-700 dark:text-neutral-300">
          Theme
        </p>
        <Link href="/profile" className="text-body-sm text-brand-600 hover:underline">
          Manage your theme in Profile settings
        </Link>
      </div>
    </div>
  );
}
