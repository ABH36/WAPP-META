"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, SkeletonText, Switch } from "@wapp/ui";
import { workspaceService } from "../../services/workspace.service";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import type { WorkspaceNotificationSettings } from "../../types/workspace";

const TOGGLES: Array<{
  key: keyof WorkspaceNotificationSettings;
  label: string;
  description: string;
}> = [
  {
    key: "taskFollowUpReminder",
    label: "Task follow-up reminders",
    description: "Notify when a CRM task's follow-up date arrives.",
  },
  {
    key: "conversationLeadAssignment",
    label: "Conversation & lead assignment",
    description: "Notify when a conversation or lead is assigned.",
  },
  {
    key: "broadcastCompleted",
    label: "Broadcast completed",
    description: "Notify when a broadcast finishes sending.",
  },
  {
    key: "subscriptionReminder",
    label: "Subscription reminders",
    description: "Notify about upcoming renewals or trial expiry.",
  },
];

/** FRD-001 Volume-3 §4.6 — the workspace-level 4-boolean set only (`Workspace.notificationSettings`, owned by the workspace module). The separate per-user event×channel matrix (Settings module) is out of scope for this volume. */
export function NotificationSettingsForm(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", "current"],
    queryFn: () => workspaceService.current(),
  });

  const handleToggle = async (key: keyof WorkspaceNotificationSettings, next: boolean) => {
    setError(null);
    setSavingKey(key);
    try {
      const updated = await workspaceService.updateNotificationSettings({ [key]: next });
      queryClient.setQueryData(["workspace", "current"], updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSavingKey(null);
    }
  };

  if (workspaceQuery.isLoading) {
    return <SkeletonText lines={4} />;
  }

  const settings = workspaceQuery.data?.notificationSettings;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {!canEdit ? (
        <Alert variant="info">
          Only the workspace Owner or Administrator can change notification settings.
        </Alert>
      ) : null}

      <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {TOGGLES.map((toggle) => (
          <div key={toggle.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <label
                htmlFor={toggle.key}
                className="text-body font-medium text-neutral-900 dark:text-neutral-50"
              >
                {toggle.label}
              </label>
              <p className="text-body-sm text-neutral-500 dark:text-neutral-400">
                {toggle.description}
              </p>
            </div>
            <Switch
              id={toggle.key}
              aria-label={toggle.label}
              checked={settings?.[toggle.key] ?? false}
              disabled={!canEdit || savingKey === toggle.key}
              onCheckedChange={(next) => void handleToggle(toggle.key, next)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
