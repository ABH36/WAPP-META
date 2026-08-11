"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, Card, Input, RevenueChart, SkeletonCard, SummaryCard } from "@wapp/ui";
import { crmService } from "../../services/crm.service";
import { useHasPermission } from "../../lib/permissions";
import { downloadBlob } from "../../lib/download-blob";
import { ApiError } from "../../lib/api";
import type { ExportFormat, ExportReportType, ReportsQueryOptions } from "../../types/crm";

function ExportButton({
  type,
  query,
}: {
  type: ExportReportType;
  query: ReportsQueryOptions;
}): React.JSX.Element {
  const [busy, setBusy] = React.useState<ExportFormat | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setError(null);
    setBusy(format);
    try {
      const blob = await crmService.exportReport(type, format, query);
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
 * FRD-001 Volume-5 §4.10 — Lead/Deal/Activity Report only; "Sales
 * Report"/"Customer Report" have no backend routes and are filed as Tech
 * Debt (Architecture Review, 2026-08-11). All `VIEW_REPORTS` grants see
 * identical workspace-wide data — the scoped permission levels aren't
 * enforced server-side (ADR-CRM-020) — so this screen never implies
 * per-role narrowing in its copy.
 */
export function ReportsView(): React.JSX.Element {
  const canView = useHasPermission(Permission.VIEW_REPORTS);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const query: ReportsQueryOptions = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const queryKeySuffix = [dateFrom, dateTo];

  const leadReportQuery = useQuery({
    queryKey: ["crm", "reports", "leads", ...queryKeySuffix],
    queryFn: () => crmService.leadReport(query),
    enabled: canView,
  });

  const dealReportQuery = useQuery({
    queryKey: ["crm", "reports", "deals", ...queryKeySuffix],
    queryFn: () => crmService.dealReport(query),
    enabled: canView,
  });

  const activityReportQuery = useQuery({
    queryKey: ["crm", "reports", "activities", ...queryKeySuffix],
    queryFn: () => crmService.activityReport(query),
    enabled: canView,
  });

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Reports.</Alert>;
  }

  const lead = leadReportQuery.data;
  const deal = dealReportQuery.data;
  const activity = activityReportQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="report-from"
            className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
          >
            From
          </label>
          <Input
            id="report-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="report-to"
            className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
          >
            To
          </label>
          <Input
            id="report-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Lead Report</h3>
          <ExportButton type="leads" query={query} />
        </div>
        {leadReportQuery.isLoading || !lead ? (
          <SkeletonCard />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Total leads" value={lead.totalLeads} />
              <SummaryCard label="Conversion rate" value={`${lead.conversionRate.toFixed(1)}%`} />
              <SummaryCard
                label="Qualification rate"
                value={`${lead.qualificationRate.toFixed(1)}%`}
              />
              <SummaryCard label="Lost rate" value={`${lead.lostRate.toFixed(1)}%`} />
            </div>
            <Card>
              <RevenueChart
                type="pie"
                data={lead.leadSourceDistribution.map((d) => ({ label: d.key, value: d.count }))}
              />
            </Card>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Deal Report</h3>
          <ExportButton type="deals" query={query} />
        </div>
        {dealReportQuery.isLoading || !deal ? (
          <SkeletonCard />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Total deals" value={deal.totalDeals} />
              <SummaryCard label="Won" value={deal.wonCount} />
              <SummaryCard label="Lost" value={deal.lostCount} />
              <SummaryCard
                label="Average deal value"
                value={deal.averageDealValue.toLocaleString()}
              />
            </div>
            <Card>
              <RevenueChart
                type="bar"
                data={deal.revenueByStage.map((d) => ({ label: d.stage, value: d.value }))}
              />
            </Card>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Activity Report</h3>
          <ExportButton type="activities" query={query} />
        </div>
        {activityReportQuery.isLoading || !activity ? (
          <SkeletonCard />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Tasks pending" value={activity.tasksPending} />
              <SummaryCard label="Tasks completed" value={activity.tasksCompleted} />
              <SummaryCard label="Follow-ups due" value={activity.followUpsDue} />
              <SummaryCard label="Notes created" value={activity.notesCreated} />
            </div>
            <Card>
              <RevenueChart
                type="bar"
                data={activity.activitiesByType.map((d) => ({ label: d.key, value: d.count }))}
              />
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
