import type {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  UsageCounterType,
} from "@wapp/shared-types";

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

/** FRD-001 Volume-6 §4.4 — mirrors `apps/api`'s `InvoiceSummary`. `amount`/`tax` are nullable until GTM pricing/tax approval (TD-009/TD-011) — never render as `₹0`, always a "Pricing pending" style placeholder. */
export interface InvoiceSummary {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  invoiceNumber: string;
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

/** FRD-001 Volume-6 §4.5 — mirrors `apps/api`'s `PaymentSummary`. `verified`/`evidenceUrl` are only ever set by a Platform operator's manual recording — always `false`/`null` for tenant-recorded Payments. */
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
  verified: boolean;
  evidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** FRD-001 Volume-6 §4.3 — mirrors `apps/api`'s `EntitlementsSummary`. All 9 currently `true` for every plan (Phase-1: same feature set, differing only by usage limits). */
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

/** FRD-001 Volume-6 §4.3 — mirrors `apps/api`'s `UsageLimitsByCounter`. Every field is nullable and, today, actually null for every workspace (TD-014, pending commercial approval) — null reads as "not yet capped," never as zero. */
export interface UsageLimitsByCounter {
  teamMembers: number | null;
  customers: number | null;
  leads: number | null;
  deals: number | null;
  broadcasts: number | null;
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

/** FRD-001 Volume-6 §4.3 — mirrors `apps/api`'s `UsageHistoryEntrySummary`, a generic append-only event log entry (not counter-specific). */
export interface UsageHistoryEntrySummary {
  id: string;
  workspaceId: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface TrialReportSummary {
  isInTrial: boolean;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

/** FRD-001 Volume-6 §4.7 — mirrors `apps/api`'s `BillingSubscriptionReport`. Folds "Trial Report" in via `trial` — no dedicated `/trial` route exists (ADR-BILL-010). */
export interface BillingSubscriptionReport {
  subscription: SubscriptionSummary;
  planName: string;
  daysUntilRenewal: number | null;
  trial: TrialReportSummary;
}

export interface BillingInvoiceReport {
  totalInvoices: number;
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

/** FRD-001 Volume-6 §4.8 — mirrors `apps/api`'s `RevenueForecast`. `expectedAmount` is null until GTM pricing is approved (TD-009). This is the entirety of Forecast's backend support — no multi-period bucket forecast, no renewal-likelihood forecast, no trial-conversion forecast exist (Architecture Review, 2026-08-11: Renewal Forecast / Trial Conversion excluded, filed as Tech Debt). */
export interface RevenueForecast {
  nextRenewalDate: string;
  expectedAmount: number | null;
}

/** FRD-001 Volume-6 §4.7/§4.8 — mirrors `apps/api`'s `RevenueReport`. Folds "Forecast" in via the `forecast` field — no dedicated `/forecast` route exists (ADR-BILL-010). */
export interface RevenueReport {
  monthlyRevenue: number;
  annualRevenue: number;
  monthlyBreakdown: MonthlyRevenueEntry[];
  forecast: RevenueForecast;
}

/** Mirrors the real `ExportBillingReportType`/`ExportFormat` enums (`export-billing-report.dto.ts`) — lowercase string values, same convention CRM's export DTO already established. Note `subscription` is singular here, unlike the `/billing/reports/subscriptions` route it maps to. */
export type ExportBillingReportType =
  "dashboard" | "subscription" | "invoices" | "payments" | "revenue" | "usage";
export type ExportFormat = "csv" | "excel";
