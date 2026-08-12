import { apiGet, apiPost } from "../lib/api";
import type { ExportEntityType, ExportJobSummary, SettingsExportFormat } from "../types/settings";

export interface CreateExportJobPayload {
  entityType: ExportEntityType;
  format: SettingsExportFormat;
}

/**
 * FRD-001 Volume-7 §4.11 — `EDIT_WORKSPACE`. Genuinely asynchronous: `create`
 * enqueues and returns immediately (`PENDING`), the backend enforces max one
 * active job per workspace (rejects with a 400 if one is already PENDING/
 * PROCESSING). No download/stream route exists — once `getStatus()` returns
 * `status: "COMPLETED"`, `resultUrl` is a direct Storage link the browser
 * opens itself, never proxied through this API.
 */
export const exportService = {
  create(payload: CreateExportJobPayload): Promise<ExportJobSummary> {
    return apiPost("/settings/export", payload);
  },

  getStatus(id: string): Promise<ExportJobSummary> {
    return apiGet(`/settings/export/${id}`);
  },
};
