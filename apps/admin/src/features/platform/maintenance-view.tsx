"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import { Alert, Button, Input, MaintenanceBanner, SkeletonCard } from "@wapp/ui";
import { maintenanceService } from "../../services/maintenance.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

/**
 * FRD-001 Volume-8 §4.12 — Maintenance Mode. `MANAGE_PLATFORM_MAINTENANCE`
 * (Super-Admin-only). Genuinely platform-gating — blocks tenant login
 * platform-wide, distinct from Settings' workspace-scoped toggle. No
 * "Started By"/"Started At" rendered — never returned by this endpoint.
 */
export function MaintenanceView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.MANAGE_PLATFORM_MAINTENANCE);
  const canEdit = useHasFullPlatformPermission(PlatformPermission.MANAGE_PLATFORM_MAINTENANCE);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reasonDraft, setReasonDraft] = React.useState("");

  const statusQuery = useQuery({
    queryKey: ["platform", "maintenance"],
    queryFn: () => maintenanceService.getStatus(),
    enabled: canView,
  });

  const handleToggle = async (enabled: boolean) => {
    if (enabled && reasonDraft.trim().length < 10) {
      setError("A reason of at least 10 characters is required to enable Maintenance Mode.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await maintenanceService.setStatus(enabled, enabled ? reasonDraft.trim() : undefined);
      setReasonDraft("");
      await queryClient.invalidateQueries({ queryKey: ["platform", "maintenance"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update maintenance mode.");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Maintenance Mode.</Alert>;
  }

  if (statusQuery.isLoading || !statusQuery.data) {
    return <SkeletonCard />;
  }

  const status = statusQuery.data;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <MaintenanceBanner enabled={status.enabled} reason={status.reason} />

      {canEdit ? (
        status.enabled ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            loading={busy}
            onClick={() => void handleToggle(false)}
          >
            Disable Maintenance Mode
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              aria-label="Reason"
              placeholder="Reason (min. 10 characters)"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-fit"
              loading={busy}
              onClick={() => void handleToggle(true)}
            >
              Enable Maintenance Mode
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
