"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlatformPermission, WorkspaceStatus } from "@wapp/shared-types";
import { Alert, HealthStatusCard, SkeletonCard, SummaryCard } from "@wapp/ui";
import { dashboardService } from "../../services/dashboard.service";
import { useHasPlatformPermission } from "../../lib/permissions";

const currency = (value: number): string => `₹${value.toLocaleString("en-IN")}`;

const QUICK_ACTIONS = [
  { href: "/workspaces", label: "Workspace Registry" },
  { href: "/platform-users", label: "Platform Users" },
  { href: "/billing", label: "Billing Operations" },
  { href: "/support", label: "Support" },
  { href: "/audit", label: "Audit Center" },
] as const;

/**
 * FRD-001 Volume-8 §4.1 — no single all-in-one dashboard endpoint exists;
 * composes `GET /platform/dashboard` (workspace/user/CRM/revenue counts +
 * system health) and `GET /platform/billing/dashboard` (active
 * subscriptions + billing-operator counters) — the only two real
 * endpoints, per Architecture Review, 2026-08-12. No platform-wide
 * "Recent Platform Activity" — that field doesn't exist anywhere.
 */
export function DashboardView(): React.JSX.Element {
  const canView = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_DASHBOARD);
  const canViewBilling = useHasPlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING);

  const snapshotQuery = useQuery({
    queryKey: ["platform", "dashboard"],
    queryFn: () => dashboardService.snapshot(),
    enabled: canView,
    // FRD-001 Volume-9 §4.1/§8 — includes live systemHealth; the global
    // 30s staleTime is too coarse for infra status an operator relies on
    // for incident response. Same 15s-polling precedent Communication's
    // Inbox established in Volume-4 (no WebSocket/SSE exists anywhere).
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const billingSnapshotQuery = useQuery({
    queryKey: ["platform", "billing", "dashboard"],
    queryFn: () => dashboardService.billingSnapshot(),
    enabled: canViewBilling,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to the Platform Dashboard.</Alert>;
  }

  if (snapshotQuery.isLoading || !snapshotQuery.data) {
    return <SkeletonCard />;
  }

  const snapshot = snapshotQuery.data;
  const billing = billingSnapshotQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total Workspaces" value={snapshot.workspaces.total} />
        <SummaryCard
          label="Active Workspaces"
          value={snapshot.workspaces.byStatus[WorkspaceStatus.ACTIVE] ?? 0}
        />
        <SummaryCard
          label="Suspended Workspaces"
          value={snapshot.workspaces.byStatus[WorkspaceStatus.SUSPENDED] ?? 0}
        />
        <SummaryCard
          label="Archived Workspaces"
          value={snapshot.workspaces.byStatus[WorkspaceStatus.ARCHIVED] ?? 0}
        />
        <SummaryCard label="Total Users" value={snapshot.totalUsers} />
        {canViewBilling && billing ? (
          <SummaryCard label="Active Subscriptions" value={billing.activeSubscriptions} />
        ) : null}
        <SummaryCard label="Revenue Summary" value={currency(snapshot.totalRevenue)} />
      </div>

      <div>
        <h3 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">Platform Health</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(snapshot.systemHealth).map(([name, isUp]) => (
            <HealthStatusCard key={name} name={name} status={isUp ? "UP" : "DOWN"} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-h3 mb-3 text-neutral-900 dark:text-neutral-50">Quick Actions</h3>
        <div className="flex flex-wrap gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="text-body-sm text-brand-500 hover:underline"
            >
              {action.label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
