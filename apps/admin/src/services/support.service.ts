import { apiGet, apiPatch, apiPost } from "../lib/api";
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketSummary,
} from "../types/platform";

export interface ListSupportTicketsParams {
  workspaceId?: string;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedOperator?: string;
}

export interface CreateSupportTicketPayload {
  workspaceId: string;
  title: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
}

export interface UpdateSupportTicketPayload {
  status?: SupportTicketStatus;
  assignedOperator?: string;
  resolution?: string;
}

/**
 * FRD-001 Volume-8 §4.5 — `MANAGE_SUPPORT`. No pagination on this list
 * route (filters only). Assign/Change Status/Resolve/Close all go through
 * one generic `PATCH` — there is no dedicated `/assign`, `/resolve`, or
 * `/close` route. No Support Dashboard aggregate endpoint exists — this
 * screen composes from this list call alone.
 */
export const supportService = {
  listTickets(params: ListSupportTicketsParams): Promise<SupportTicketSummary[]> {
    return apiGet("/platform/support/tickets", params as Record<string, unknown>);
  },

  createTicket(payload: CreateSupportTicketPayload): Promise<SupportTicketSummary> {
    return apiPost("/platform/support/tickets", payload);
  },

  updateTicket(id: string, payload: UpdateSupportTicketPayload): Promise<SupportTicketSummary> {
    return apiPatch(`/platform/support/tickets/${id}`, payload);
  },
};
