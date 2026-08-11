import { DealStage, LeadStatus } from "@wapp/shared-types";

/**
 * FRD-001 Volume-5 §4.2/§4.5 — mirrors `apps/api`'s `LEAD_STATUS_TRANSITIONS`/
 * `DEAL_STAGE_TRANSITIONS` (`crm.constants.ts`) exactly, purely so the
 * status/stage picker only ever offers a valid next state — the backend
 * remains the sole enforcer (BR-007); this is a UX convenience, not
 * validation duplication. If the backend's own transition table ever
 * changes, this needs updating alongside it — there's no way to fetch it
 * dynamically.
 */
const LEAD_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.CONTACTED]: [LeadStatus.QUALIFIED, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.QUALIFIED]: [LeadStatus.PROPOSAL_SENT, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.PROPOSAL_SENT]: [LeadStatus.NEGOTIATION, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.NEGOTIATION]: [LeadStatus.WON, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  [LeadStatus.WON]: [],
  [LeadStatus.LOST]: [],
  [LeadStatus.UNQUALIFIED]: [],
};

export function getValidLeadTransitions(current: LeadStatus): LeadStatus[] {
  return LEAD_STATUS_TRANSITIONS[current];
}

/** `LOST → OPEN` exists only via the dedicated `POST /crm/deals/:id/reopen` route, never through this table. */
const DEAL_STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
  [DealStage.OPEN]: [DealStage.QUALIFICATION, DealStage.LOST],
  [DealStage.QUALIFICATION]: [DealStage.PROPOSAL, DealStage.LOST],
  [DealStage.PROPOSAL]: [DealStage.NEGOTIATION, DealStage.LOST],
  [DealStage.NEGOTIATION]: [DealStage.WON, DealStage.LOST],
  [DealStage.WON]: [],
  [DealStage.LOST]: [],
};

export function getValidDealTransitions(current: DealStage): DealStage[] {
  return DEAL_STAGE_TRANSITIONS[current];
}
