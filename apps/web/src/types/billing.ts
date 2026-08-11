import type { BillingCycle, SubscriptionStatus, UsageCounterType } from "@wapp/shared-types";

/** FRD-001 Volume-3 §4.1/§4.8 — mirrors `apps/api`'s `SubscriptionSummary`. The source of "Current Plan" — Workspace itself has no plan field. */
export interface SubscriptionSummary {
  id: string;
  workspaceId: string;
  planId: string;
  pendingPlanId: string | null;
  status: SubscriptionStatus;
  startDate: string;
  renewalDate: string;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  cancelledAt: string | null;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `PlanSummary`. Fetched to resolve `SubscriptionSummary.planId` into a readable plan name — `GET /billing/plans` shares `BILLING_ACCESS` with the subscription/dashboard reads, so no new permission surface is introduced. */
export interface PlanSummary {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  billingCycle: BillingCycle;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `CounterUsageSummary`. */
export interface CounterUsageSummary {
  counterType: UsageCounterType;
  count: number;
  limit: number | null;
  percentage: number | null;
  locked: boolean;
}

/** FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `UsageSummary`. */
export interface UsageSummary {
  workspaceId: string;
  counters: CounterUsageSummary[];
}

/** FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `PlanDistributionEntry`. */
export interface PlanDistributionEntry {
  planName: string;
  count: number;
}

/**
 * FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `BillingDashboardReport`
 * field-for-field. Workspace-scoped (ADR-BILL-010): every field describes
 * this Workspace's own single Subscription, never a cross-tenant total.
 * The Billing Summary Card renders only a small subset of these fields
 * (`pendingInvoices`, `paidInvoices`, `monthlyRevenue`) — the full shape
 * is typed faithfully, but §4.8's "navigation summaries only, no
 * duplicated dashboard logic" rule keeps the card itself minimal.
 */
export interface BillingDashboardReport {
  activeSubscriptions: number;
  trialWorkspaces: number;
  expiredWorkspaces: number;
  gracePeriodWorkspaces: number;
  monthlyRevenue: number;
  annualRevenue: number;
  pendingInvoices: number;
  paidInvoices: number;
  failedPayments: number;
  refunds: number;
  planDistribution: PlanDistributionEntry[];
  usage: UsageSummary;
}
