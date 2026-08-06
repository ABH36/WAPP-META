/**
 * Traces to: PRD-004 Volume-2 §7/§8 (Lead Lifecycle/Status), PRD-000C
 * BDC-015. PROPOSAL_SENT/NEGOTIATION added per Volume-2's pipeline;
 * ASSIGNED retired — assignment is a separate field (Lead.assignedUserId,
 * §10), never a status value (resolved 2026-08-06, Architecture Review).
 *
 * UNQUALIFIED vs LOST (BDC-015 — do not conflate, preserved from Volume-2
 * even though Volume-2's own §8 list doesn't repeat it):
 * - UNQUALIFIED: the lead never matched business qualification criteria.
 * - LOST: a qualified opportunity that was not converted.
 *
 * WON triggers Lead Conversion (ADR-007/008/009) — see lead-conversion domain logic
 * in apps/api/src/modules/crm, never re-implemented in the frontend.
 */
export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  PROPOSAL_SENT = "PROPOSAL_SENT",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
  UNQUALIFIED = "UNQUALIFIED",
}

export const TERMINAL_LEAD_STATUSES: readonly LeadStatus[] = [
  LeadStatus.WON,
  LeadStatus.LOST,
  LeadStatus.UNQUALIFIED,
];

/** Reasons a Lead may be marked Lost — PRD-004 Volume 2 §I. */
export enum LeadLostReason {
  PRICE = "PRICE",
  NO_RESPONSE = "NO_RESPONSE",
  COMPETITOR = "COMPETITOR",
  REQUIREMENT_CLOSED = "REQUIREMENT_CLOSED",
  DUPLICATE = "DUPLICATE",
  OTHER = "OTHER",
}

/**
 * Traces to: PRD-004 Volume-2 §6. Deliberately a client-supplied field on
 * creation (resolved 2026-08-06) — unlike CustomerSource, not every value
 * here maps to a distinct creation method (Website/Referral have no
 * dedicated Lead Creation Method in §5), so it can't be purely derived the
 * way CustomerSource is.
 */
export enum LeadSource {
  WHATSAPP = "WHATSAPP",
  MANUAL_ENTRY = "MANUAL_ENTRY",
  WEBSITE = "WEBSITE",
  REFERRAL = "REFERRAL",
  EXISTING_CUSTOMER = "EXISTING_CUSTOMER",
}
