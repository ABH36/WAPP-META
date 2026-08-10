import { apiGet, apiPost } from "../lib/api";
import type { LoginHistorySummary } from "../types/auth";

/**
 * FRD-001 Volume-2 §4.6/§4.7 — thin, typed wrappers over `/settings/security/*`
 * (`SecuritySettingsController`, `apps/api/src/modules/settings/controllers/
 * security-settings.controller.ts`) — deliberately a SEPARATE service file
 * from `auth.service.ts`, mirroring the backend's own module boundary
 * (Settings orchestrates, Identity remains sole owner of the underlying
 * logic — ADR-SET-004). Change Password and Login History are exposed here,
 * not under `/auth/*`, even though both ultimately call into `AuthService`
 * on the backend.
 */
export const securitySettingsService = {
  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return apiPost("/settings/security/change-password", { currentPassword, newPassword });
  },

  /** Every other session is revoked as a side effect of a successful change — the backend's own returned `message` reflects this, always display it verbatim rather than authoring separate success copy. */
  loginHistory(): Promise<LoginHistorySummary[]> {
    return apiGet("/settings/security/login-history");
  },
};
