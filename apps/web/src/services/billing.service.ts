import { apiClient, apiGet, apiPost } from "../lib/api";
import type {
  BillingDashboardReport,
  BillingInvoiceReport,
  BillingPaymentReport,
  BillingSubscriptionReport,
  EntitlementsSummary,
  ExportBillingReportType,
  ExportFormat,
  InvoiceSummary,
  PaymentSummary,
  PlanLimitsSummary,
  PlanSummary,
  RevenueReport,
  SubscriptionSummary,
  UsageHistoryEntrySummary,
  UsageSummary,
} from "../types/billing";

/**
 * FRD-001 Volume-3 §4.1/§4.8 / FRD-001 Volume-6 — Billing module reads and
 * writes. Every route requires `BILLING_ACCESS` (Owner=FULL,
 * Administrator=VIEW_ONLY, everyone else=NONE) — callers must gate on
 * `useHasPermission` for reads and `useHasFullPermission` for writes
 * (`lib/permissions.ts`), never rely on the 403 alone. Subscription
 * upgrade/downgrade/cancel and Payment record/refund are the only write
 * routes anywhere in Billing — Invoices, Usage, Plans and every Report
 * stay strictly read-only, matching the backend exactly (no
 * `POST /billing/invoices`, no invoice mutation routes at all). Payment
 * record/refund are intentionally NOT called from this UI — §4.5 scopes
 * Payments to view-only on the frontend even though the tenant routes
 * exist server-side (a known interim gap, TD-010).
 */
export const billingService = {
  subscription(): Promise<SubscriptionSummary> {
    return apiGet("/billing/subscription");
  },

  upgradeSubscription(planId: string): Promise<SubscriptionSummary> {
    return apiPost("/billing/subscription/upgrade", { planId });
  },

  downgradeSubscription(planId: string): Promise<SubscriptionSummary> {
    return apiPost("/billing/subscription/downgrade", { planId });
  },

  cancelSubscription(): Promise<SubscriptionSummary> {
    return apiPost("/billing/subscription/cancel");
  },

  plans(): Promise<PlanSummary[]> {
    return apiGet("/billing/plans");
  },

  usage(): Promise<UsageSummary> {
    return apiGet("/billing/usage");
  },

  limits(): Promise<PlanLimitsSummary> {
    return apiGet("/billing/limits");
  },

  entitlements(): Promise<EntitlementsSummary> {
    return apiGet("/billing/entitlements");
  },

  usageHistory(): Promise<UsageHistoryEntrySummary[]> {
    return apiGet("/billing/usage/history");
  },

  invoices(): Promise<InvoiceSummary[]> {
    return apiGet("/billing/invoices");
  },

  invoice(id: string): Promise<InvoiceSummary> {
    return apiGet(`/billing/invoices/${id}`);
  },

  payments(): Promise<PaymentSummary[]> {
    return apiGet("/billing/payments");
  },

  payment(id: string): Promise<PaymentSummary> {
    return apiGet(`/billing/payments/${id}`);
  },

  dashboardReport(): Promise<BillingDashboardReport> {
    return apiGet("/billing/reports/dashboard");
  },

  subscriptionReport(): Promise<BillingSubscriptionReport> {
    return apiGet("/billing/reports/subscriptions");
  },

  invoiceReport(): Promise<BillingInvoiceReport> {
    return apiGet("/billing/reports/invoices");
  },

  paymentReport(): Promise<BillingPaymentReport> {
    return apiGet("/billing/reports/payments");
  },

  revenueReport(): Promise<RevenueReport> {
    return apiGet("/billing/reports/revenue");
  },

  usageReport(): Promise<UsageSummary> {
    return apiGet("/billing/reports/usage");
  },

  /**
   * `GET /billing/reports/export` returns a binary file (CSV/Excel), not a
   * JSON envelope — same authenticated-blob pattern CRM Reports already
   * established (`ADR-FE-001`: the access token lives in memory only, a
   * plain `<a href>` can't carry it).
   */
  async exportReport(type: ExportBillingReportType, format: ExportFormat): Promise<Blob> {
    const response = await apiClient.get<Blob>("/billing/reports/export", {
      params: { type, format },
      responseType: "blob",
    });
    return response.data;
  },
};
