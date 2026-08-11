import { apiGet } from "../lib/api";
import type { BillingDashboardReport, PlanSummary, SubscriptionSummary } from "../types/billing";

/**
 * FRD-001 Volume-3 §4.1/§4.8 — Billing module reads consumed by the
 * Workspace Dashboard's Subscription/Billing Summary Cards. All three
 * routes require `BILLING_ACCESS` (Owner=FULL, Administrator=VIEW_ONLY,
 * everyone else=NONE) — callers must gate on `useHasPermission` before
 * invoking any of these (`lib/permissions.ts`), never rely on the 403
 * alone. No write routes here — this volume is read-only against Billing.
 */
export const billingService = {
  subscription(): Promise<SubscriptionSummary> {
    return apiGet("/billing/subscription");
  },

  dashboardReport(): Promise<BillingDashboardReport> {
    return apiGet("/billing/reports/dashboard");
  },

  plans(): Promise<PlanSummary[]> {
    return apiGet("/billing/plans");
  },
};
