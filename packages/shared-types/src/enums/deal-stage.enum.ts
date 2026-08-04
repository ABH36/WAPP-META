/**
 * Traces to: PRD-004 Volume 4 §B (Pipeline Stages).
 * WON auto-triggers Lead Conversion when the Deal is linked to an unconverted
 * Lead (ADR-009) — Deal Won → Auto Lead Conversion → Customer Created/Linked → Deal Closed Won.
 */
export enum DealStage {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
}

export const TERMINAL_DEAL_STAGES: readonly DealStage[] = [DealStage.WON, DealStage.LOST];

/** Reasons a Deal may be marked Lost — PRD-004 Volume 4 §G. */
export enum DealLostReason {
  PRICE = "PRICE",
  COMPETITOR = "COMPETITOR",
  NO_RESPONSE = "NO_RESPONSE",
  BUDGET = "BUDGET",
  REQUIREMENT_CHANGED = "REQUIREMENT_CHANGED",
  OTHER = "OTHER",
}
