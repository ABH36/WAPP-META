import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { PlatformPaginated } from "../types/pagination";
import type {
  SupportSessionStatus,
  SupportSessionSummary,
  SupportWorkspaceOverview,
} from "../types/platform";

export interface ListSupportSessionsParams {
  workspaceId?: string;
  status?: SupportSessionStatus;
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-8 §4.6 — Break-Glass. `REQUEST_SUPPORT_ACCESS` to
 * request, `APPROVE_SUPPORT_ACCESS` to approve, `START_SUPPORT_SESSION`
 * to start/end, `VIEW_INVESTIGATION` to list sessions and read the
 * workspace overview. No "Reject" route exists — a `REQUESTED` session
 * can only ever be approved, never explicitly declined (Architecture
 * Review, 2026-08-12: Approve-only UI, filed as Tech Debt). Read-only
 * confirmed — no route anywhere writes to a tenant's own data or issues a
 * token that acts as a tenant user (TD-023).
 */
export const breakGlassService = {
  requestAccess(
    workspaceId: string,
    reason: string,
    durationMinutes: number,
  ): Promise<SupportSessionSummary> {
    return apiPost("/platform/support/access/request", { workspaceId, reason, durationMinutes });
  },

  approveAccess(id: string): Promise<SupportSessionSummary> {
    return apiPatch(`/platform/support/access/${id}/approve`);
  },

  startSession(id: string): Promise<SupportSessionSummary> {
    return apiPost(`/platform/support/sessions/${id}/start`);
  },

  endSession(id: string, reason?: string): Promise<SupportSessionSummary> {
    return apiPost(`/platform/support/sessions/${id}/end`, { reason });
  },

  listSessions(
    params: ListSupportSessionsParams,
  ): Promise<PlatformPaginated<SupportSessionSummary>> {
    return apiGet("/platform/support/sessions", params as Record<string, unknown>);
  },

  getWorkspaceOverview(workspaceId: string): Promise<SupportWorkspaceOverview> {
    return apiGet(`/platform/support/workspaces/${workspaceId}`);
  },
};
