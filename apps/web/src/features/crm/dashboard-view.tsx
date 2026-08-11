"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityType, Permission } from "@wapp/shared-types";
import {
  Alert,
  EmptyState,
  SkeletonCard,
  SkeletonText,
  SummaryCard,
  Timeline,
  TimelineItem,
} from "@wapp/ui";
import { crmService } from "../../services/crm.service";
import { activityService } from "../../services/activity.service";
import { useActivityViewPermission, useHasPermission } from "../../lib/permissions";
import type { ActivitySummary } from "../../types/activity";

function RecentActivityRow({
  activity,
  last,
}: {
  activity: ActivitySummary;
  last: boolean;
}): React.JSX.Element | null {
  const canView = useActivityViewPermission(activity.customerId, activity.dealId);
  if (!canView) return null;
  return (
    <TimelineItem last={last}>
      <p className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
        {activity.type === ActivityType.NOTE ? activity.text : (activity.title ?? activity.type)}
      </p>
      <p className="text-caption text-neutral-500 dark:text-neutral-400">
        {activity.type} · {new Date(activity.createdAt).toLocaleString()}
      </p>
    </TimelineItem>
  );
}

/**
 * FRD-001 Volume-5 §4.3 — composed strictly from `crmService.dashboardSummary()`
 * plus a separate Activities query for "Recent Activity" (Architecture
 * Review, 2026-08-11: "Recent Activity shall be composed using a separate
 * Activities query," not derived from the summary). No report
 * distribution charts here — those live on the Reports screen; this stays
 * a navigation-and-glance surface, matching §4.8's Summary Card
 * philosophy (SummaryCard's own doc comment: "no duplicated dashboard
 * logic").
 */
export function DashboardView(): React.JSX.Element {
  const canView = useHasPermission(Permission.VIEW_REPORTS);

  const summaryQuery = useQuery({
    queryKey: ["crm", "reports", "dashboard"],
    queryFn: () => crmService.dashboardSummary(),
    enabled: canView,
  });

  const recentActivityQuery = useQuery({
    queryKey: ["crm", "activities", "recent"],
    queryFn: () =>
      activityService.list({ sortBy: "createdAt", sortOrder: "desc", page: 1, limit: 10 }),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to the CRM Dashboard.</Alert>;
  }

  const summary = summaryQuery.data;
  const activities = recentActivityQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      {summaryQuery.isLoading || !summary ? (
        <SkeletonCard />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            label="Total customers"
            value={summary.totalCustomers}
            description={`${summary.activeCustomers} active`}
          />
          <SummaryCard
            label="Total leads"
            value={summary.totalLeads}
            description={`${summary.qualifiedLeads} qualified`}
          />
          <SummaryCard
            label="Open deals"
            value={summary.openDeals}
            description={`${summary.totalDeals} total`}
          />
          <SummaryCard
            label="Won deals"
            value={summary.wonDeals}
            description={`${summary.lostDeals} lost`}
          />
          <SummaryCard label="Pipeline value" value={summary.pipelineValue.toLocaleString()} />
          <SummaryCard
            label="Forecast value"
            value={summary.forecastValue.toLocaleString()}
            description="Weighted"
          />
          <SummaryCard label="Overdue tasks" value={summary.overdueTasks} />
          <SummaryCard label="Upcoming follow-ups" value={summary.upcomingFollowUps} />
        </div>
      )}

      <div>
        <h3 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">Recent activity</h3>
        {recentActivityQuery.isLoading ? (
          <SkeletonText lines={4} />
        ) : activities.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="Recent Activities across the CRM will appear here."
          />
        ) : (
          <Timeline>
            {activities.map((activity, index) => (
              <RecentActivityRow
                key={activity.id}
                activity={activity}
                last={index === activities.length - 1}
              />
            ))}
          </Timeline>
        )}
      </div>
    </div>
  );
}
