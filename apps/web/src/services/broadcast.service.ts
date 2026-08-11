import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { Paginated } from "../types/pagination";
import type {
  BroadcastRecipientStats,
  BroadcastRecipientSummary,
  BroadcastSummary,
} from "../types/broadcast";

export interface CreateBroadcastPayload {
  name: string;
  templateId: string;
  phoneNumberId: string;
  targetContactIds: string[];
  bodyParameters: string[];
  scheduledAt?: string;
}

/**
 * FRD-001 Volume-4 §4.6 — one-time bulk template sends, a distinct
 * resource from Campaign (Architecture Review, 2026-08-11: the backend
 * implements both as separate resources; the frontend preserves that
 * distinction rather than treating "Campaigns" as an umbrella term). No
 * edit route exists for a Broadcast — only create + status-transition
 * actions (send/pause/resume/cancel).
 */
export const broadcastService = {
  list(): Promise<BroadcastSummary[]> {
    return apiGet("/communication/broadcasts");
  },

  getById(id: string): Promise<BroadcastSummary> {
    return apiGet(`/communication/broadcasts/${id}`);
  },

  getStats(id: string): Promise<BroadcastRecipientStats> {
    return apiGet(`/communication/broadcasts/${id}/stats`);
  },

  listRecipients(
    id: string,
    page?: number,
    limit?: number,
  ): Promise<Paginated<BroadcastRecipientSummary>> {
    return apiGet(`/communication/broadcasts/${id}/recipients`, { page, limit });
  },

  create(payload: CreateBroadcastPayload): Promise<BroadcastSummary> {
    return apiPost("/communication/broadcasts", payload);
  },

  send(id: string): Promise<BroadcastSummary> {
    return apiPost(`/communication/broadcasts/${id}/send`);
  },

  pause(id: string): Promise<BroadcastSummary> {
    return apiPatch(`/communication/broadcasts/${id}/pause`);
  },

  resume(id: string): Promise<BroadcastSummary> {
    return apiPatch(`/communication/broadcasts/${id}/resume`);
  },

  cancel(id: string): Promise<BroadcastSummary> {
    return apiPatch(`/communication/broadcasts/${id}/cancel`);
  },
};
