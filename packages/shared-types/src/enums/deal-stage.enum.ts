/**
 * Traces to: PRD-004 Volume-4 §4 (Deal Lifecycle). Linear pipeline —
 * OPEN → QUALIFICATION → PROPOSAL → NEGOTIATION → WON, with LOST reachable
 * from any non-terminal stage (resolved 2026-08-06, Architecture Review —
 * mirrors LeadStatus's own LOST/UNQUALIFIED reachability, not the PRD's
 * literal "OPEN → LOST" diagram, which undersells the real transition set
 * the same way LeadStatus's diagram did). WON and LOST are terminal; LOST
 * may be reopened back to OPEN via a dedicated endpoint, WON may not — see
 * docs/ADR-CRM-012-deal-lifecycle-strategy.md.
 */
export enum DealStage {
  OPEN = "OPEN",
  QUALIFICATION = "QUALIFICATION",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
}

export const TERMINAL_DEAL_STAGES: readonly DealStage[] = [DealStage.WON, DealStage.LOST];

/** Reasons a Deal may be marked Lost — PRD-004 Volume-4 §6 (mandatory only when stage = LOST, BR-007). */
export enum DealLostReason {
  PRICE = "PRICE",
  COMPETITOR = "COMPETITOR",
  NO_RESPONSE = "NO_RESPONSE",
  BUDGET = "BUDGET",
  REQUIREMENT_CHANGED = "REQUIREMENT_CHANGED",
  OTHER = "OTHER",
}
