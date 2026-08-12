"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission, USAGE_WARNING_THRESHOLDS, UsageCounterType } from "@wapp/shared-types";
import { Alert, FeatureLimitCard, SkeletonCard } from "@wapp/ui";
import { billingService } from "../../services/billing.service";
import { useHasPermission } from "../../lib/permissions";

const COUNTER_LABELS: Record<UsageCounterType, string> = {
  [UsageCounterType.TEAM_MEMBERS]: "Team Members",
  [UsageCounterType.CUSTOMERS]: "Customers",
  [UsageCounterType.LEADS]: "Leads",
  [UsageCounterType.DEALS]: "Deals",
  [UsageCounterType.BROADCASTS]: "Broadcasts",
  [UsageCounterType.CAMPAIGNS]: "Campaigns",
  [UsageCounterType.MESSAGES]: "Messages",
  [UsageCounterType.STORAGE]: "Storage",
  [UsageCounterType.API_REQUESTS]: "API Requests",
};

const WARNING_THRESHOLD = Math.min(...USAGE_WARNING_THRESHOLDS);

/**
 * FRD-001 Volume-6 §4.3 — read-only ("no mutation endpoints, Usage is
 * system-managed" — `usage.controller.ts`). `locked` is a real backend
 * field (only 6 of 9 counters have a real creation-time event to hook
 * into yet — Campaigns/Storage/API Requests always return `locked: false`,
 * TD-013 — not misrepresented here as "never locks," just not enforced
 * yet). "Threshold Alerts" have no backend field to consume — this screen
 * computes them itself using the shared, backend-owned
 * `USAGE_WARNING_THRESHOLDS` constant (`@wapp/shared-types`), never an
 * invented percentage (Architecture Review, 2026-08-11).
 */
export function UsageView(): React.JSX.Element {
  const canView = useHasPermission(Permission.BILLING_ACCESS);

  const usageQuery = useQuery({
    queryKey: ["billing", "usage"],
    queryFn: () => billingService.usage(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Billing.</Alert>;
  }

  if (usageQuery.isLoading || !usageQuery.data) {
    return <SkeletonCard />;
  }

  const counters = usageQuery.data.counters;
  const nearingLimit = counters.filter(
    (c) => c.percentage !== null && c.percentage >= WARNING_THRESHOLD,
  );

  return (
    <div className="flex flex-col gap-4">
      {nearingLimit.length > 0 ? (
        <Alert variant="warning">
          {nearingLimit.length} feature{nearingLimit.length > 1 ? "s are" : " is"} nearing its usage
          limit.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {counters.map((counter) => (
          <FeatureLimitCard
            key={counter.counterType}
            label={COUNTER_LABELS[counter.counterType] ?? counter.counterType}
            count={counter.count}
            limit={counter.limit}
            percentage={counter.percentage}
            locked={counter.locked}
          />
        ))}
      </div>
    </div>
  );
}
