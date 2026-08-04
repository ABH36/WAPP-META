/**
 * Traces to: ADR-039 (Payment Status Naming — standardized platform-wide, "Success" retired
 * in favor of "Paid"). PARTIALLY_REFUNDED and CHARGEBACK are Future Phase values, included
 * here only so the enum is forward-compatible without a breaking rename later.
 */
export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  /** Future Phase — Refund Automation is out of scope for Phase-1 (PRD-005 Out of Scope). */
  REFUNDED = "REFUNDED",
  /** Future Phase. */
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  /** Future Phase. */
  CHARGEBACK = "CHARGEBACK",
}

/** Traces to: TAD-001 v1.2 (Payment Failure Policy) / ADR-018 — the 7-day grace period. */
export const PAYMENT_GRACE_PERIOD_DAYS = 7;

export const PAYMENT_REMINDER_SCHEDULE_DAYS: readonly number[] = [3, 5, 7];
