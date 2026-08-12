"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import { Alert, Card, RevenueChart, SkeletonCard, SummaryCard } from "@wapp/ui";
import { analyticsService } from "../../services/analytics.service";
import { useHasPlatformPermission } from "../../lib/permissions";

/**
 * FRD-001 Volume-8 §4.9 — Analytics. `VIEW_PLATFORM_ANALYTICS`. Covers
 * only Platform KPIs / Revenue / Workspace Growth — "User Growth,"
 * "Subscription Trends," and "Activity Trends" have no backend endpoint
 * anywhere (Architecture Review, 2026-08-12, tracked as Tech Debt).
 * Reuses `RevenueChart` (Volume-5) for the categorical comparisons below
 * rather than a bespoke "AnalyticsChart" — no time-series data exists on
 * either endpoint, so every chart here is a snapshot comparison, not a trend.
 */
export function AnalyticsView(): React.JSX.Element {
  const canView = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_ANALYTICS);

  const snapshotQuery = useQuery({
    queryKey: ["platform", "analytics", "snapshot"],
    queryFn: () => analyticsService.snapshot(),
    enabled: canView,
  });

  const kpisQuery = useQuery({
    queryKey: ["platform", "analytics", "kpis"],
    queryFn: () => analyticsService.kpis(),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Analytics.</Alert>;
  }

  if (snapshotQuery.isLoading || kpisQuery.isLoading || !snapshotQuery.data || !kpisQuery.data) {
    return <SkeletonCard />;
  }

  const snapshot = snapshotQuery.data;
  const kpis = kpisQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Workspaces"
          value={snapshot.totalWorkspaces}
          description={`${snapshot.activeWorkspaces} active`}
        />
        <SummaryCard
          label="Platform Users"
          value={snapshot.platformUsers}
          description={`${snapshot.activePlatformSessions} active sessions`}
        />
        <SummaryCard
          label="Messages Processed"
          value={snapshot.messagesProcessed.toLocaleString()}
        />
        <SummaryCard
          label="Total Revenue"
          value={`₹${snapshot.revenueSummary.totalRevenue.toLocaleString()}`}
        />
        <SummaryCard
          label="Support Resolution Time"
          value={
            kpis.supportResolutionTimeHours !== null
              ? `${kpis.supportResolutionTimeHours.toFixed(1)}h`
              : "—"
          }
        />
        <SummaryCard
          label="Platform Availability"
          value={`${kpis.platformAvailability.percentageUptime}%`}
          description={kpis.platformAvailability.note}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">Revenue Growth</h2>
          <RevenueChart
            type="bar"
            data={[
              { label: "Previous Month", value: kpis.revenueGrowth.previousMonth },
              { label: "Current Month", value: kpis.revenueGrowth.currentMonth },
            ]}
            valueFormatter={(v) => `₹${v.toLocaleString()}`}
          />
        </Card>
        <Card>
          <h2 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">Workspace Growth</h2>
          <RevenueChart
            type="bar"
            data={[
              { label: "New This Month", value: kpis.workspaceGrowth.newThisMonth },
              { label: "Total Workspaces", value: kpis.workspaceGrowth.totalWorkspaces },
            ]}
          />
        </Card>
        <Card>
          <h2 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">CRM Growth</h2>
          <RevenueChart
            type="bar"
            data={[
              { label: "Leads", value: snapshot.crmGrowth.totalLeads },
              { label: "Deals", value: snapshot.crmGrowth.totalDeals },
              { label: "Customers", value: snapshot.crmGrowth.totalCustomers },
            ]}
          />
        </Card>
        <Card>
          <h2 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">Feature Adoption</h2>
          <RevenueChart
            type="bar"
            data={kpis.featureAdoption.map((f) => ({
              label: f.flagKey,
              value: f.adoptionPercentage,
            }))}
            valueFormatter={(v) => `${v}%`}
          />
        </Card>
      </section>
    </div>
  );
}
