"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, Card, RevenueChart, SkeletonCard, SummaryCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";
import { downloadBlob } from "../../lib/download-blob";
import { ApiError } from "../../lib/api";
import type { ExportBillingReportType, ExportFormat } from "../../types/billing";

const currency = (value: number, code = "INR"): string => `${code} ${value.toLocaleString()}`;

function ExportButton({ type }: { type: ExportBillingReportType }): React.JSX.Element {
  const [busy, setBusy] = React.useState<ExportFormat | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setError(null);
    setBusy(format);
    try {
      const blob = await billingService.exportReport(type, format);
      downloadBlob(blob, `${type}-report.${format === "excel" ? "xlsx" : "csv"}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to export report.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-caption text-danger-600 dark:text-danger-400">{error}</span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={busy === "csv"}
        onClick={() => void handleExport("csv")}
      >
        Export CSV
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={busy === "excel"}
        onClick={() => void handleExport("excel")}
      >
        Export Excel
      </Button>
    </div>
  );
}

/**
 * FRD-001 Volume-6 §4.7 — all 6 backend-supported report endpoints are
 * exposed (Architecture Review, 2026-08-11: "Reports shall expose all
 * backend-supported report endpoints: Dashboard, Revenue, Invoices,
 * Payments, Subscriptions, Usage"), unlike CRM's Volume-5 Reports (which
 * dropped 2 of 5 named types for lacking backend support) — Billing's own
 * planning document named exactly what the backend has, no cuts needed
 * here. Exports use `ExportBillingReportType`'s exact values — note
 * `"subscription"` is singular, unlike the `/billing/reports/subscriptions`
 * read route it maps to.
 */
export function ReportsView(): React.JSX.Element {
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const dashboardQuery = useQuery({
    queryKey: ["billing", "reports", "dashboard"],
    queryFn: () => billingService.dashboardReport(),
    enabled: canView,
  });
  const revenueQuery = useQuery({
    queryKey: ["billing", "reports", "revenue"],
    queryFn: () => billingService.revenueReport(),
    enabled: canView,
  });
  const invoiceReportQuery = useQuery({
    queryKey: ["billing", "reports", "invoices"],
    queryFn: () => billingService.invoiceReport(),
    enabled: canView,
  });
  const paymentReportQuery = useQuery({
    queryKey: ["billing", "reports", "payments"],
    queryFn: () => billingService.paymentReport(),
    enabled: canView,
  });
  const subscriptionReportQuery = useQuery({
    queryKey: ["billing", "reports", "subscriptions"],
    queryFn: () => billingService.subscriptionReport(),
    enabled: canView,
  });
  const usageReportQuery = useQuery({
    queryKey: ["billing", "reports", "usage"],
    queryFn: () => billingService.usageReport(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Reports.</Alert>;
  }

  const dashboard = dashboardQuery.data;
  const revenue = revenueQuery.data;
  const invoiceReport = invoiceReportQuery.data;
  const paymentReport = paymentReportQuery.data;
  const subReport = subscriptionReportQuery.data;
  const usageReport = usageReportQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Billing Dashboard</h3>
          <ExportButton type="dashboard" />
        </div>
        {dashboardQuery.isLoading || !dashboard ? (
          <SkeletonCard />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard label="Monthly Revenue" value={currency(dashboard.monthlyRevenue)} />
            <SummaryCard label="Annual Revenue" value={currency(dashboard.annualRevenue)} />
            <SummaryCard label="Pending Invoices" value={dashboard.pendingInvoices} />
            <SummaryCard label="Failed Payments" value={dashboard.failedPayments} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Revenue Report</h3>
          <ExportButton type="revenue" />
        </div>
        {revenueQuery.isLoading || !revenue ? (
          <SkeletonCard />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Monthly Revenue" value={currency(revenue.monthlyRevenue)} />
              <SummaryCard label="Annual Revenue" value={currency(revenue.annualRevenue)} />
            </div>
            <Card>
              <RevenueChart
                type="bar"
                data={revenue.monthlyBreakdown.map((m) => ({ label: m.month, value: m.revenue }))}
              />
            </Card>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Invoice Report</h3>
          <ExportButton type="invoices" />
        </div>
        {invoiceReportQuery.isLoading || !invoiceReport ? (
          <SkeletonCard />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Total Invoices" value={invoiceReport.totalInvoices} />
              <SummaryCard
                label="Total Amount"
                value={
                  invoiceReport.totalAmount !== null
                    ? currency(invoiceReport.totalAmount)
                    : "Pricing pending"
                }
              />
            </div>
            <Card>
              <RevenueChart
                type="bar"
                data={Object.entries(invoiceReport.countByStatus).map(([status, count]) => ({
                  label: status,
                  value: count,
                }))}
              />
            </Card>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Payment Report</h3>
          <ExportButton type="payments" />
        </div>
        {paymentReportQuery.isLoading || !paymentReport ? (
          <SkeletonCard />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Total Payments" value={paymentReport.totalPayments} />
              <SummaryCard label="Total Collected" value={currency(paymentReport.totalCollected)} />
            </div>
            <Card>
              <RevenueChart
                type="bar"
                data={Object.entries(paymentReport.countByStatus).map(([status, count]) => ({
                  label: status,
                  value: count,
                }))}
              />
            </Card>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Subscription Report</h3>
          <ExportButton type="subscription" />
        </div>
        {subscriptionReportQuery.isLoading || !subReport ? (
          <SkeletonCard />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard label="Plan" value={subReport.planName} />
            <SummaryCard label="Days Until Renewal" value={subReport.daysUntilRenewal ?? "—"} />
            <SummaryCard label="In Trial" value={subReport.trial.isInTrial ? "Yes" : "No"} />
            <SummaryCard
              label="Trial Days Remaining"
              value={subReport.trial.daysRemaining ?? "—"}
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Usage Report</h3>
          <ExportButton type="usage" />
        </div>
        {usageReportQuery.isLoading || !usageReport ? (
          <SkeletonCard />
        ) : (
          <Card>
            <RevenueChart
              type="bar"
              data={usageReport.counters.map((c) => ({ label: c.counterType, value: c.count }))}
            />
          </Card>
        )}
      </section>
    </div>
  );
}
