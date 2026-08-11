import type { DealLostReason, DealStage } from "@wapp/shared-types";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { Paginated } from "../types/pagination";
import type { DealSummary } from "../types/deal";

export interface UpdateDealPayload {
  title?: string;
  description?: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
}

interface ListDealsParams {
  stage?: DealStage;
  assignedTo?: string;
  customerId?: string;
  expectedCloseFrom?: string;
  expectedCloseTo?: string;
  sortBy?: "createdAt" | "updatedAt" | "value" | "probability" | "expectedCloseDate" | "title";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-5 §4.4/§4.5 — no `create()` method exists on purpose: no
 * `POST /crm/deals` route exists anywhere (ADR-CRM-010) — a Deal is
 * created exclusively as a side effect of `leadService.convert()`. No
 * `delete()` either — a Deal is permanent once created. `updateStage()`
 * is also how "Close Won"/"Close Lost" happen — there is no dedicated
 * close route; `lostReason` is required by the backend only when
 * `stage === "LOST"` (validated server-side, not expressible in this
 * payload's own type).
 */
export const dealService = {
  list(params: ListDealsParams): Promise<Paginated<DealSummary>> {
    return apiGet("/crm/deals", params as Record<string, unknown>);
  },

  search(q: string, page?: number, limit?: number): Promise<Paginated<DealSummary>> {
    return apiGet("/crm/deals/search", { q, page, limit });
  },

  getById(id: string): Promise<DealSummary> {
    return apiGet(`/crm/deals/${id}`);
  },

  update(id: string, payload: UpdateDealPayload): Promise<DealSummary> {
    return apiPatch(`/crm/deals/${id}`, payload);
  },

  assign(id: string, assignedTo: string | null): Promise<DealSummary> {
    return apiPatch(`/crm/deals/${id}/assign`, { assignedTo });
  },

  updateStage(id: string, stage: DealStage, lostReason?: DealLostReason): Promise<DealSummary> {
    return apiPatch(`/crm/deals/${id}/stage`, { stage, lostReason });
  },

  reopen(id: string): Promise<DealSummary> {
    return apiPost(`/crm/deals/${id}/reopen`);
  },
};
