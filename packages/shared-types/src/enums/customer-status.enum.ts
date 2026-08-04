/**
 * Traces to: PRD-004 Volume 1 §B (Customer Status), ADR-010, PRD-000C BDC-014.
 *
 * BLOCKED (ADR-010) — precise semantics, do not reinterpret:
 * - Profile and conversation history remain visible.
 * - Customer is excluded from Broadcasts.
 * - New outbound messages are restricted per business policy.
 * - Still counted in reporting.
 * This is WAPP's WhatsApp opt-out / consent-enforcement mechanism.
 *
 * Status and Soft-Delete are independent axes (BDC-014) — a customer can be
 * BLOCKED and not deleted, or soft-deleted regardless of status. Never assume
 * one implies the other.
 */
export enum CustomerStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  BLOCKED = "BLOCKED",
}

/** Sources a Customer record may originate from — PRD-004 Volume 1 §C, ADR-007. */
export enum CustomerSource {
  WHATSAPP = "WHATSAPP",
  MANUAL_ENTRY = "MANUAL_ENTRY",
  LEAD_CONVERSION = "LEAD_CONVERSION",
}
