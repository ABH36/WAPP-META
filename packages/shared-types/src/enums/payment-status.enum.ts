/**
 * Traces to: ADR-039 (Payment Status Naming — standardized platform-wide, "Success" retired
 * in favor of "Paid"). PARTIALLY_REFUNDED and CHARGEBACK are Future Phase values, included
 * here only so the enum is forward-compatible without a breaking rename later.
 */
export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  /**
   * Resolved 2026-08-07 (PRD-005 Volume-2 Architecture Review): manual
   * Refund recording (POST /billing/refunds) IS in scope for Volume-2 — only
   * gateway-triggered automatic refund execution stays out of scope (no
   * Payment Gateway Integration until a later volume). This value is
   * reachable in Volume-2, not deferred.
   */
  REFUNDED = "REFUNDED",
  /** Future Phase — partial refunds are not supported; a Refund is always for the full Payment amount in Volume-2. */
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  /** Future Phase. */
  CHARGEBACK = "CHARGEBACK",
}

/** Traces to: TAD-001 v1.2 (Payment Failure Policy) / ADR-018 — the 7-day grace period. */
export const PAYMENT_GRACE_PERIOD_DAYS = 7;

export const PAYMENT_REMINDER_SCHEDULE_DAYS: readonly number[] = [3, 5, 7];
