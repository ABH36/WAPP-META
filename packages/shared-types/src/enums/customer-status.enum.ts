/**
 * Traces to: PRD-004 Volume-1 §5/§7 (Customer Lifecycle/Status), ADR-010,
 * PRD-000C BDC-014.
 *
 * Lifecycle (PRD-004 Volume-1 §5): Created -> ACTIVE -> BLOCKED -> ACTIVE ->
 * ARCHIVED. ARCHIVED is terminal (§7) — it is this module's soft-delete
 * mechanism (BR-003: "Customer deletion is prohibited. Soft Delete only"),
 * not a separate isDeleted flag layered on top of status.
 *
 * BLOCKED (ADR-010) — precise semantics, do not reinterpret:
 * - Profile and conversation history remain visible.
 * - Customer is excluded from Broadcasts.
 * - New outbound messages are restricted per business policy.
 * - Still counted in reporting.
 * This is WAPP's WhatsApp opt-out / consent-enforcement mechanism.
 *
 * ARCHIVED customers remain searchable (BR-005) — archiving hides nothing,
 * it only marks the record terminal.
 */
export enum CustomerStatus {
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
  ARCHIVED = "ARCHIVED",
}

/** Sources a Customer record may originate from — PRD-004 Volume 1 §C, ADR-007. */
export enum CustomerSource {
  WHATSAPP = "WHATSAPP",
  MANUAL_ENTRY = "MANUAL_ENTRY",
  LEAD_CONVERSION = "LEAD_CONVERSION",
}
