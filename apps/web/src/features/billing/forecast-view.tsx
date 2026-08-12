"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, SkeletonCard, SummaryCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";

const currency = (value: number, code = "INR"): string => `${code} ${value.toLocaleString()}`;

/**
 * FRD-001 Volume-6 §4.8 — intentionally minimal (Architecture Review,
 * 2026-08-11): the backend has no dedicated `/forecast` route at all —
 * only a `{nextRenewalDate, expectedAmount}` pair folded into
 * `GET /billing/reports/revenue` (ADR-BILL-010). "Renewal Forecast" and
 * "Trial Conversion" are excluded entirely — no equivalent backend data
 * exists for either, and both are filed as Tech Debt rather than
 * approximated client-side. `expectedAmount` is null until GTM pricing is
 * approved (TD-009) — rendered as "Pricing pending," never `₹0`.
 */
export function ForecastView(): React.JSX.Element {
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const revenueQuery = useQuery({
    queryKey: ["billing", "reports", "revenue"],
    queryFn: () => billingService.revenueReport(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Forecast.</Alert>;
  }

  if (revenueQuery.isLoading || !revenueQuery.data) {
    return <SkeletonCard />;
  }

  const { forecast } = revenueQuery.data;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <SummaryCard
        label="Next Renewal Date"
        value={new Date(forecast.nextRenewalDate).toLocaleDateString()}
      />
      <SummaryCard
        label="Expected Amount"
        value={
          forecast.expectedAmount !== null ? currency(forecast.expectedAmount) : "Pricing pending"
        }
      />
    </div>
  );
}
