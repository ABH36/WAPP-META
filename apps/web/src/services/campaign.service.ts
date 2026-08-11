import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { BroadcastSummary } from "../types/broadcast";
import type { CampaignStatsSummary, CampaignSummary } from "../types/campaign";

export interface CreateCampaignWavePayload {
  name: string;
  templateId: string;
  bodyParameters: string[];
  scheduledAt: string;
}

export interface CreateCampaignPayload {
  name: string;
  phoneNumberId: string;
  targetContactIds: string[];
  waves: CreateCampaignWavePayload[];
}

/**
 * FRD-001 Volume-4 §4.6 — multi-wave orchestration built on top of
 * Broadcast; every wave is a real, independent Broadcast
 * (`Broadcast.campaignId` back-reference), fetched via `waves()`. Reuses
 * Broadcast's own permissions (`VIEW_BROADCASTS`/`CREATE_BROADCAST`/
 * `SEND_BROADCAST`) — no dedicated Campaign permission exists. No edit
 * route and no per-Campaign send/pause/resume — only create + cancel.
 */
export const campaignService = {
  list(): Promise<CampaignSummary[]> {
    return apiGet("/communication/campaigns");
  },

  getById(id: string): Promise<CampaignSummary> {
    return apiGet(`/communication/campaigns/${id}`);
  },

  listWaves(id: string): Promise<BroadcastSummary[]> {
    return apiGet(`/communication/campaigns/${id}/waves`);
  },

  getStats(id: string): Promise<CampaignStatsSummary> {
    return apiGet(`/communication/campaigns/${id}/stats`);
  },

  create(payload: CreateCampaignPayload): Promise<CampaignSummary> {
    return apiPost("/communication/campaigns", payload);
  },

  cancel(id: string): Promise<CampaignSummary> {
    return apiPatch(`/communication/campaigns/${id}/cancel`);
  },
};
