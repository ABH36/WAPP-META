import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import type {
  ConfigHistoryEntrySummary,
  LogoUploadSignature,
  SettingsOverview,
  SettingsPreferences,
} from "../types/settings";

type UpdatePreferencesPayload = Partial<SettingsPreferences>;

interface ConfigHistoryPage {
  items: ConfigHistoryEntrySummary[];
  total: number;
  page: number;
  limit: number;
}

/**
 * FRD-001 Volume-3 §4.4/§4.5 — Settings module routes (`ADR-SET-001`
 * orchestration boundary): `overview()` is the single bundled read every
 * `/workspace/*` management page uses; `updatePreferences`/branding
 * methods are the only writes Settings genuinely owns. Business Profile,
 * Business Hours, and Notification Settings writes stay on
 * `workspace.service.ts` — Settings only composes those into `overview()`,
 * it never owns writing them.
 */
export const settingsService = {
  overview(): Promise<SettingsOverview> {
    return apiGet("/settings");
  },

  updatePreferences(payload: UpdatePreferencesPayload): Promise<SettingsOverview> {
    return apiPatch("/settings/preferences", payload);
  },

  getLogoUploadSignature(): Promise<LogoUploadSignature> {
    return apiPost("/settings/branding/logo/upload-signature");
  },

  confirmLogo(payload: { logoUrl: string; logoPublicId: string }): Promise<SettingsOverview> {
    return apiPatch("/settings/branding/logo", payload);
  },

  removeLogo(): Promise<SettingsOverview> {
    return apiDelete("/settings/branding/logo");
  },

  /** FRD-001 Volume-7 §4.1 — `EDIT_WORKSPACE`. Powers Settings Home's "Recent configuration summary." */
  configHistory(page?: number, limit?: number): Promise<ConfigHistoryPage> {
    return apiGet("/settings/config-history", { page, limit });
  },
};
