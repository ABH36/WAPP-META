import { apiGet, apiPatch } from "../lib/api";
import type { PlatformMaintenanceStatus } from "../types/platform";

/**
 * FRD-001 Volume-8 §4.12 — Maintenance Mode. `MANAGE_PLATFORM_MAINTENANCE`
 * (Super-Admin-only). Genuinely platform-gating — `PLATFORM_MAINTENANCE_ENABLED`
 * blocks tenant login platform-wide (`AuthService.login()`), distinct from
 * and more powerful than Settings' workspace-scoped maintenance toggle.
 * "Started By"/"Started At" are persisted in Mongo but never returned by
 * this endpoint — omitted here to match reality (Architecture Review,
 * 2026-08-12).
 */
export const maintenanceService = {
  getStatus(): Promise<PlatformMaintenanceStatus> {
    return apiGet("/platform/maintenance");
  },

  setStatus(enabled: boolean, reason?: string): Promise<PlatformMaintenanceStatus> {
    return apiPatch("/platform/maintenance", { enabled, reason });
  },
};
