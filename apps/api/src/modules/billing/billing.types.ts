import type {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  UsageCounterType,
} from "@wapp/shared-types";

export interface PlanSummary {
  id: string;
  name: string;
  description: string | null;
  // Nullable until GTM pricing is formally approved — TD-009, docs/TECH-DEBT.md.
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  billingCycle: BillingCycle;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface InvoiceSummary {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  invoiceNumber: string;
  // Nullable until GTM pricing/tax approval — TD-009/TD-011.
  amount: number | null;
  tax: number | null;
  currency: string;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  id: string;
  workspaceId: string;
  invoiceId: string;
  gateway: string;
  gatewayReference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  refundedAt: string | null;
  recordedBy: string;
  // PRD-007 Volume-2 §4.3 — only ever set by a platform operator's manual recording; always false/null for tenant-recorded Payments.
  verified: boolean;
  evidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementsSummary {
  crm: boolean;
  broadcast: boolean;
  campaigns: boolean;
  automation: boolean;
  teamMembers: boolean;
  reports: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  integrations: boolean;
}

export interface UsageLimitsByCounter {
  teamMembers: number | null;
  customers: number | null;
  leads: number | null;
  deals: number | null;
  broadcasts: number | null;
  // Nullable and never populated in this volume — TD-013 (no creation-time
  // event exists to count Campaigns; Storage/API Requests likewise deferred).
  campaigns: number | null;
  messages: number | null;
  storage: number | null;
  apiRequests: number | null;
}

export interface PlanLimitsSummary {
  planId: string;
  entitlements: EntitlementsSummary;
  limits: UsageLimitsByCounter;
}

export interface CounterUsageSummary {
  counterType: UsageCounterType;
  count: number;
  // Null means either "unlimited" is not yet a real possibility (limit not
  // yet approved, TD-014) or the counter itself is deferred (TD-013) — both
  // read the same way to a client: nothing to warn about yet.
  limit: number | null;
  percentage: number | null;
  locked: boolean;
}

export interface UsageSummary {
  workspaceId: string;
  counters: CounterUsageSummary[];
}

/** PRD-007 Volume-2 §4.5 — Customer Support's "Recent Activity" read. */
export interface BillingHistoryEntrySummary {
  id: string;
  workspaceId: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface UsageHistoryEntrySummary {
  id: string;
  workspaceId: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface PlanDistributionEntry {
  planName: string;
  count: number;
}

/**
 * Workspace-scoped (resolved 2026-08-07, Architecture Review) — every field
 * below describes THIS Workspace's own single Subscription, never a
 * cross-tenant total. activeSubscriptions/trialWorkspaces/
 * expiredWorkspaces/gracePeriodWorkspaces are each 0 or 1, matching that a
 * Workspace has exactly one Subscription in exactly one status at a time —
 * see docs/ADR-BILL-010-billing-reporting-boundary.md.
 */
export interface BillingDashboardReport {
  activeSubscriptions: number;
  trialWorkspaces: number;
  // Derived from Workspace.status === EXPIRED (covers both GRACE_PERIOD and
  // non-payment SUSPENDED Subscription states, per ADR-BILL-002's mapping)
  // — a broader signal than gracePeriodWorkspaces below.
  expiredWorkspaces: number;
  gracePeriodWorkspaces: number;
  monthlyRevenue: number;
  annualRevenue: number;
  // "Pending" maps to InvoiceStatus.ISSUED — no literal PENDING value exists.
  pendingInvoices: number;
  paidInvoices: number;
  failedPayments: number;
  refunds: number;
  planDistribution: PlanDistributionEntry[];
  usage: UsageSummary;
}

export interface TrialReportSummary {
  isInTrial: boolean;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

/** §Reports "Trial Report" is folded in here (§13's API surface has no dedicated /trial route) rather than a separate endpoint — see ADR-BILL-010. */
export interface BillingSubscriptionReport {
  subscription: SubscriptionSummary;
  planName: string;
  daysUntilRenewal: number | null;
  trial: TrialReportSummary;
}

export interface BillingInvoiceReport {
  totalInvoices: number;
  // Null only when zero Invoices have a non-null amount (TD-011) — distinct
  // from 0, which would misleadingly assert "confirmed zero," not "not yet
  // priced."
  totalAmount: number | null;
  countByStatus: Record<InvoiceStatus, number>;
  invoices: InvoiceSummary[];
}

export interface BillingPaymentReport {
  totalPayments: number;
  totalCollected: number;
  countByStatus: Record<PaymentStatus, number>;
  payments: PaymentSummary[];
}

export interface MonthlyRevenueEntry {
  month: string;
  revenue: number;
}

export interface RevenueForecast {
  nextRenewalDate: string;
  // Null until GTM pricing is approved (TD-009) — computed the same way
  // InvoiceService.generateForSubscriptionUpgrade() computes Invoice.amount.
  expectedAmount: number | null;
}

/** §Reports "Forecast" is folded in here (§13's API surface has no dedicated /forecast route) rather than a separate endpoint — see ADR-BILL-010. */
export interface RevenueReport {
  monthlyRevenue: number;
  annualRevenue: number;
  monthlyBreakdown: MonthlyRevenueEntry[];
  forecast: RevenueForecast;
}
