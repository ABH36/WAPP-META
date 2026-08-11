/** FRD-001 Volume-4 — mirrors `apps/api`'s local `CampaignStatus` enum (`campaign.schema.ts`), which has no `@wapp/shared-types` equivalent at all. No `DRAFT` state exists — a Campaign is only ever created already `ACTIVE` (every wave requires a `scheduledAt` at creation). */
export type CampaignStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

/** Mirrors `CampaignSummary`. A Campaign owns no send mechanics of its own — every "wave" is a real, independent `BroadcastSummary` (`Broadcast.campaignId` back-reference), fetched separately via `GET .../campaigns/:id/waves`. */
export interface CampaignSummary {
  id: string;
  name: string;
  phoneNumberId: string;
  targetContactIds: string[];
  status: CampaignStatus;
  completedAt: string | null;
  createdAt: string;
}

/** Mirrors `CampaignStatsSummary` — send-attempt totals summed across every wave, same Layer-1-only boundary as `BroadcastRecipientStats`. */
export interface CampaignStatsSummary {
  waveCount: number;
  pending: number;
  sent: number;
  failed: number;
  total: number;
}
