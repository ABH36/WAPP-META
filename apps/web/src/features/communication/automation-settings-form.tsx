"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, Select, SkeletonText, Switch, Textarea } from "@wapp/ui";
import { automationService } from "../../services/automation.service";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import type { AssignmentStrategy } from "../../types/automation";

const STRATEGIES: AssignmentStrategy[] = ["NONE", "ROUND_ROBIN", "LEAST_ACTIVE"];

/**
 * FRD-001 Volume-4 §4.9 — presented as "Automation Settings," not
 * "Automation Rules" (Architecture Review, 2026-08-11): the backend
 * exposes one Settings object per workspace (Welcome/Away toggles +
 * assignment strategy), never a list of named rules — no rule-builder UI
 * is introduced. Away-message firing depends on `Workspace.businessHours`
 * (a separate screen, FRD-001 Volume-3's `/workspace/business-hours`) —
 * linked below rather than duplicated here.
 */
export function AutomationSettingsForm(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const settingsQuery = useQuery({
    queryKey: ["communication", "automation-settings"],
    queryFn: () => automationService.get(),
  });

  const [welcomeEnabled, setWelcomeEnabled] = React.useState(false);
  const [welcomeText, setWelcomeText] = React.useState("");
  const [awayEnabled, setAwayEnabled] = React.useState(false);
  const [awayText, setAwayText] = React.useState("");
  const [strategy, setStrategy] = React.useState<AssignmentStrategy>("NONE");

  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setWelcomeEnabled(settingsQuery.data.welcomeMessageEnabled);
    setWelcomeText(settingsQuery.data.welcomeMessageText ?? "");
    setAwayEnabled(settingsQuery.data.awayMessageEnabled);
    setAwayText(settingsQuery.data.awayMessageText ?? "");
    setStrategy(settingsQuery.data.assignmentStrategy);
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const updated = await automationService.update({
        welcomeMessageEnabled: welcomeEnabled,
        welcomeMessageText: welcomeText || null,
        awayMessageEnabled: awayEnabled,
        awayMessageText: awayText || null,
        assignmentStrategy: strategy,
      });
      queryClient.setQueryData(["communication", "automation-settings"], updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save automation settings.");
    } finally {
      setSaving(false);
    }
  };

  if (settingsQuery.isLoading) {
    return <SkeletonText lines={6} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {!canEdit ? (
        <Alert variant="info">
          Only the workspace Owner or Administrator can change automation settings.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="welcome-enabled"
            className="text-body font-medium text-neutral-900 dark:text-neutral-50"
          >
            Welcome message
          </label>
          <Switch
            id="welcome-enabled"
            checked={welcomeEnabled}
            disabled={!canEdit}
            onCheckedChange={setWelcomeEnabled}
          />
        </div>
        <Textarea
          aria-label="Welcome message text"
          disabled={!canEdit || !welcomeEnabled}
          value={welcomeText}
          onChange={(event) => setWelcomeText(event.target.value)}
          placeholder="Sent to a contact's first message"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="away-enabled"
            className="text-body font-medium text-neutral-900 dark:text-neutral-50"
          >
            Away message
          </label>
          <Switch
            id="away-enabled"
            checked={awayEnabled}
            disabled={!canEdit}
            onCheckedChange={setAwayEnabled}
          />
        </div>
        <Textarea
          aria-label="Away message text"
          disabled={!canEdit || !awayEnabled}
          value={awayText}
          onChange={(event) => setAwayText(event.target.value)}
          placeholder="Sent outside your configured business hours"
        />
        <Link
          href="/workspace/business-hours"
          className="text-caption text-brand-600 w-fit hover:underline"
        >
          Manage business hours
        </Link>
      </div>

      <div className="max-w-xs">
        <label
          htmlFor="assignment-strategy"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Auto-assignment strategy
        </label>
        <Select
          id="assignment-strategy"
          disabled={!canEdit}
          value={strategy}
          onChange={(event) => setStrategy(event.target.value as AssignmentStrategy)}
        >
          {STRATEGIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>

      {canEdit ? (
        <Button
          type="button"
          variant="primary"
          loading={saving}
          className="w-fit"
          onClick={() => void handleSave()}
        >
          Save changes
        </Button>
      ) : null}
    </div>
  );
}
