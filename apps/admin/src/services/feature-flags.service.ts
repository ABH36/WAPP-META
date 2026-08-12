import { apiGet, apiPatch } from "../lib/api";
import type { FeatureFlagKey, PlatformFeatureFlagSummary } from "../types/platform";

/**
 * FRD-001 Volume-8 §4.11 — Feature Flags. `MANAGE_PLATFORM_FEATURE_FLAGS`
 * (Super-Admin-only). `list()` always returns exactly 5 rows (one per
 * `FeatureFlagKey`), the backend's own service pads unset keys with
 * `enabled: null` — no client-side padding needed. Single global override
 * per flag, not per-workspace — "Workspace Overrides" has no backend
 * support anywhere (Architecture Review, 2026-08-12).
 */
export const featureFlagsService = {
  list(): Promise<PlatformFeatureFlagSummary[]> {
    return apiGet("/platform/feature-flags");
  },

  setEnabled(flagKey: FeatureFlagKey, enabled: boolean): Promise<PlatformFeatureFlagSummary> {
    return apiPatch(`/platform/feature-flags/${flagKey}`, { enabled });
  },
};
