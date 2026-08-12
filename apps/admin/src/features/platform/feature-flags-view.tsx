"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import { Alert, Button, FeatureFlagCard, SkeletonCard } from "@wapp/ui";
import { featureFlagsService } from "../../services/feature-flags.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import type { FeatureFlagKey } from "../../types/platform";

/**
 * FRD-001 Volume-8 §4.11 — Feature Flags. `MANAGE_PLATFORM_FEATURE_FLAGS`
 * (Super-Admin-only). `list()` always returns exactly 5 rows — no client
 * padding needed. Single global override per flag, not per-workspace
 * (Architecture Review, 2026-08-12 — "Workspace Overrides" tracked as
 * Tech Debt). No route exists to clear an override back to "Inherit"
 * once set — only Enable/Disable are offered.
 */
export function FeatureFlagsView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS);
  const canEdit = useHasFullPlatformPermission(PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const flagsQuery = useQuery({
    queryKey: ["platform", "feature-flags"],
    queryFn: () => featureFlagsService.list(),
    enabled: canView,
  });

  const handleSetEnabled = async (flagKey: FeatureFlagKey, enabled: boolean) => {
    setError(null);
    setBusy(flagKey);
    try {
      await featureFlagsService.setEnabled(flagKey, enabled);
      await queryClient.invalidateQueries({ queryKey: ["platform", "feature-flags"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update feature flag.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Feature Flags.</Alert>;
  }

  const flags = flagsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {flagsQuery.isLoading ? (
        <SkeletonCard />
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((flag) => (
            <FeatureFlagCard
              key={flag.flagKey}
              flagKey={flag.flagKey}
              enabled={flag.enabled}
              actions={
                canEdit ? (
                  <>
                    {flag.enabled !== true ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={busy === flag.flagKey}
                        onClick={() => void handleSetEnabled(flag.flagKey, true)}
                      >
                        Enable
                      </Button>
                    ) : null}
                    {flag.enabled !== false ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        loading={busy === flag.flagKey}
                        onClick={() => void handleSetEnabled(flag.flagKey, false)}
                      >
                        Disable
                      </Button>
                    ) : null}
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
