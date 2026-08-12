import type { WorkspaceStatus } from "@wapp/shared-types";
import { apiGet, apiPatch } from "../lib/api";
import type { PlatformWorkspaceSummary } from "../types/platform";
import type { PlatformPaginated } from "../types/pagination";

export interface ListWorkspacesParams {
  status?: WorkspaceStatus;
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-8 §4.2 — Workspace Registry. `q` is free-text search
 * across Workspace Name only (no owner-name search exists). `VIEW_WORKSPACES`
 * for reads, `MANAGE_WORKSPACE_STATUS` for the one generic status-change
 * route covering Suspend/Reactivate/Archive — `status: "ACTIVE"` means
 * Reactivate. No `GET /platform/workspaces/:id` route exists (list-only);
 * no route edits workspace name or business data (BR-002 — lifecycle
 * actions only, confirmed against the controller directly).
 */
export const workspacesService = {
  list(params: ListWorkspacesParams): Promise<PlatformPaginated<PlatformWorkspaceSummary>> {
    return apiGet("/platform/workspaces", params as Record<string, unknown>);
  },

  updateStatus(
    id: string,
    status: WorkspaceStatus,
    reason?: string,
  ): Promise<PlatformWorkspaceSummary> {
    return apiPatch(`/platform/workspaces/${id}/status`, { status, reason });
  },
};
