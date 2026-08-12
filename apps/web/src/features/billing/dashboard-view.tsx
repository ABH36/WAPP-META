"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, SkeletonCard, StageBadge, SummaryCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";

const currency = (value: number, code = "INR"): string => `${code} ${value.toLocaleString()}`;

/**
 * FRD-001 Volume-6 §4.1 — composed strictly from existing backend
 * endpoints (Architecture Review, 2026-08-11: "No frontend aggregation or
 * commercial calculations shall be introduced"): `GET
 * /billing/reports/subscriptions` supplies the "identity" cards (Current
 * Plan/Status/Trial/Next Renewal — already resolved and joined
 * server-side, so this screen never joins `planId` against the Plan list
 * itself), and `GET /billing/reports/dashboard` supplies the "numbers"
 * cards (Monthly/Annual Revenue, Invoice Summary counts, Usage Summary).
 * Quick Actions are plain links to the other Billing screens — no
 * duplicated logic.
 */
export function DashboardView(): React.JSX.Element {
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const dashboardQuery = useQuery({
    queryKey: ["billing", "reports", "dashboard"],
    queryFn: () => billingService.dashboardReport(),
    enabled: canView,
  });

  const subscriptionReportQuery = useQuery({
    queryKey: ["billing", "reports", "subscriptions"],
    queryFn: () => billingService.subscriptionReport(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing.</Alert>;
  }

  const dashboard = dashboardQuery.data;
  const subReport = subscriptionReportQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {dashboardQuery.isLoading || subscriptionReportQuery.isLoading || !dashboard || !subReport ? (
        <SkeletonCard />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard label="Current Plan" value={subReport.planName} />
            <SummaryCard
              label="Subscription Status"
              value={<StageBadge value={subReport.subscription.status} />}
            />
            <SummaryCard
              label="Trial Status"
              value={
                subReport.trial.isInTrial
                  ? `${subReport.trial.daysRemaining ?? "—"} days left`
                  : "Not in trial"
              }
            />
            <SummaryCard
              label="Next Renewal"
              value={new Date(subReport.subscription.renewalDate).toLocaleDateString()}
              description={
                subReport.daysUntilRenewal !== null
                  ? `${subReport.daysUntilRenewal} days away`
                  : undefined
              }
            />
            <SummaryCard label="Monthly Revenue" value={currency(dashboard.monthlyRevenue)} />
            <SummaryCard label="Annual Revenue" value={currency(dashboard.annualRevenue)} />
            <SummaryCard
              label="Active Subscription"
              value={dashboard.activeSubscriptions > 0 ? "Yes" : "No"}
            />
            <SummaryCard
              label="Invoice Summary"
              value={`${dashboard.pendingInvoices} pending`}
              description={`${dashboard.paidInvoices} paid`}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <Link href="/billing/usage" className="text-body-sm text-brand-600 hover:underline">
              View Usage →
            </Link>
            <Link href="/billing/invoices" className="text-body-sm text-brand-600 hover:underline">
              View Invoices →
            </Link>
            <Link href="/billing/payments" className="text-body-sm text-brand-600 hover:underline">
              View Payments →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
