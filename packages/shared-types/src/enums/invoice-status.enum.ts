/**
 * Traces to: PRD-005 Volume-2 §4/§7 (Invoice Lifecycle / Invoice Entity).
 * Resolved 2026-08-07, Architecture Review: §4's diagram
 * (DRAFT->ISSUED->PAID->VOID->REFUNDED) is the maximal path, not a literal
 * state graph — same reasoning already applied to SubscriptionStatus
 * (docs/ADR-BILL-002-workspace-billing-synchronization.md) and, before
 * that, LeadStatus/DealStage. The actual branch structure Volume-2
 * implements: ISSUED -> {PAID | VOID}, PAID -> REFUNDED. DRAFT and VOID
 * exist for forward-compatibility (a future manual invoice-authoring path)
 * but are not produced by any code path in Volume-2 — every Invoice
 * Volume-2 generates is created directly in ISSUED, and nothing in this
 * volume's approved API surface (no invoice-mutation endpoints beyond
 * payment recording) ever voids one. See
 * docs/ADR-BILL-004-invoice-payment-relationship.md.
 */
export enum InvoiceStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  PAID = "PAID",
  VOID = "VOID",
  REFUNDED = "REFUNDED",
}

export const TERMINAL_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.VOID,
  InvoiceStatus.REFUNDED,
];
