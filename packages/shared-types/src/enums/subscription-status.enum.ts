/**
 * Traces to: PRD-005 Volume-1 §4/§6 (Subscription Lifecycle). Deliberately
 * separate from WorkspaceStatus (workspace-status.enum.ts, "canonical — do
 * not re-derive elsewhere") — resolved 2026-08-07, Architecture Review:
 * Subscription owns its own richer lifecycle (including GRACE_PERIOD, which
 * WorkspaceStatus has no equivalent for), and drives WorkspaceStatus via
 * domain events rather than sharing one literal status value. See
 * docs/ADR-BILL-001-subscription-ownership-strategy.md and
 * docs/ADR-BILL-002-workspace-billing-synchronization.md.
 */
export enum SubscriptionStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  GRACE_PERIOD = "GRACE_PERIOD",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
}

export const TERMINAL_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.CANCELLED,
];

/** PRD-005 Volume-1 §5/§6. */
export enum BillingCycle {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

/**
 * §11 — resolved 2026-08-07 as 7 days, matching the already-approved
 * PAYMENT_GRACE_PERIOD_DAYS (payment-status.enum.ts, TAD-001 v1.2/ADR-018)
 * exactly. Kept as its own constant rather than importing that one: the two
 * are conceptually distinct (a subscription-wide grace window vs. a single
 * payment attempt's retry window) even though they currently share the same
 * value — see docs/ADR-BILL-001-subscription-ownership-strategy.md.
 */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;
