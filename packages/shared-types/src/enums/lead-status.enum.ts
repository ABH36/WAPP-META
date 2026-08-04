/**
 * Traces to: PRD-004 Volume 2 §B (Lead Status), PRD-000C BDC-015.
 *
 * UNQUALIFIED vs LOST (BDC-015 — do not conflate):
 * - UNQUALIFIED: the lead never matched business qualification criteria.
 * - LOST: a qualified opportunity that was not converted.
 *
 * WON triggers Lead Conversion (ADR-007/008/009) — see lead-conversion domain logic
 * in apps/api/src/modules/crm, never re-implemented in the frontend.
 */
export enum LeadStatus {
  NEW = "NEW",
  ASSIGNED = "ASSIGNED",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  UNQUALIFIED = "UNQUALIFIED",
  WON = "WON",
  LOST = "LOST",
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
