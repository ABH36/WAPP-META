import type { DealLostReason, DealStage } from "@wapp/shared-types";

/**
 * FRD-001 Volume-5 §4.4 — mirrors `apps/api`'s `DealSummary`. No
 * `DealStatus` exists separately — `WON`/`LOST` are real `DealStage`
 * values. Field is `assignedTo`, not `assignedUserId` (Lead's own naming)
 * — the two entities use different names for the same "owner" concept,
 * confirmed against the real schema, not assumed.
 */
export interface DealSummary {
  id: string;
  workspaceId: string;
  contactId: string;
  customerId: string;
  sourceLeadId: string;
  title: string;
  description: string | null;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  assignedTo: string | null;
  stage: DealStage;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: DealLostReason | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
