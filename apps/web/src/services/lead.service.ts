import type { LeadSource, LeadStatus } from "@wapp/shared-types";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { Paginated } from "../types/pagination";
import type { LeadConversionResult, LeadSummary } from "../types/lead";

export interface CreateLeadPayload {
  leadName: string;
  mobileNumber?: string;
  contactId?: string;
  customerId?: string;
  source: LeadSource;
  company?: string;
  email?: string;
  industry?: string;
  expectedValue?: number;
  notes?: string;
}

export type UpdateLeadPayload = Partial<
  Pick<CreateLeadPayload, "leadName" | "company" | "email" | "industry" | "expectedValue" | "notes">
>;

interface ListLeadsParams {
  status?: LeadStatus;
  source?: LeadSource;
  assignedUserId?: string;
  sortBy?: "leadName" | "createdAt" | "updatedAt" | "expectedValue";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-5 §4.2 — every mutation route is gated by the single
 * `UPDATE_LEAD_STAGE` permission (edit/assign/status/archive) — there is
 * no dedicated `ASSIGN_LEADS`/`EDIT_LEAD` permission (Architecture
 * Review, 2026-08-11). `archive()` is Leads' entire "Delete" — no hard
 * delete route exists.
 */
export const leadService = {
  create(payload: CreateLeadPayload): Promise<LeadSummary> {
    return apiPost("/crm/leads", payload);
  },

  list(params: ListLeadsParams): Promise<Paginated<LeadSummary>> {
    return apiGet("/crm/leads", params as Record<string, unknown>);
  },

  search(q: string, page?: number, limit?: number): Promise<Paginated<LeadSummary>> {
    return apiGet("/crm/leads/search", { q, page, limit });
  },

  getById(id: string): Promise<LeadSummary> {
    return apiGet(`/crm/leads/${id}`);
  },

  update(id: string, payload: UpdateLeadPayload): Promise<LeadSummary> {
    return apiPatch(`/crm/leads/${id}`, payload);
  },

  assign(id: string, assignedUserId: string | null): Promise<LeadSummary> {
    return apiPatch(`/crm/leads/${id}/assign`, { assignedUserId });
  },

  updateStatus(id: string, status: LeadStatus): Promise<LeadSummary> {
    return apiPatch(`/crm/leads/${id}/status`, { status });
  },

  archive(id: string): Promise<LeadSummary> {
    return apiPatch(`/crm/leads/${id}/archive`);
  },

  convert(id: string): Promise<LeadConversionResult> {
    return apiPost(`/crm/leads/${id}/convert`);
  },
};
