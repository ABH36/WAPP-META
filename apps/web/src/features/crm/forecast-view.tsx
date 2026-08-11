"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, Card, RevenueChart, Select, SkeletonCard, SummaryCard } from "@wapp/ui";
import { crmService } from "../../services/crm.service";
import { useHasPermission } from "../../lib/permissions";
import { downloadBlob } from "../../lib/download-blob";
import { ApiError } from "../../lib/api";
import type { ForecastBucket } from "../../types/crm";

type BucketPeriod = "monthly" | "quarterly" | "yearly";

const BUCKET_OPTIONS: Array<{ value: BucketPeriod; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

/**
 * FRD-001 Volume-5 §4.11 — `pipelineForecast` is probability-weighted
 * (`value × probability/100`); this is deliberately never shown next to
 * or labeled like the Dashboard's raw `pipelineValue`, to avoid implying
 * they're the same number (Architecture Review, 2026-08-11). No
 * "probability breakdown" screen — that field doesn't exist on the
 * backend response.
 */
export function ForecastView(): React.JSX.Element {
  const canView = useHasPermission(Permission.VIEW_REPORTS);
  const [period, setPeriod] = React.useState<BucketPeriod>("monthly");
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const forecastQuery = useQuery({
    queryKey: ["crm", "reports", "forecast"],
    queryFn: () => crmService.forecast(),
    enabled: canView,
  });

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const blob = await crmService.exportReport("forecast", "csv");
      downloadBlob(blob, "forecast-report.csv");
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Failed to export forecast.");
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Forecast.</Alert>;
  }

  if (forecastQuery.isLoading || !forecastQuery.data) {
    return <SkeletonCard />;
  }

  const forecast = forecastQuery.data;
  const buckets: ForecastBucket[] =
    period === "monthly"
      ? forecast.monthlyForecast
      : period === "quarterly"
        ? forecast.quarterlyForecast
        : forecast.yearlyForecast;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SummaryCard
          label="Weighted pipeline forecast"
          value={forecast.pipelineForecast.toLocaleString()}
          description="Probability-weighted — distinct from the Dashboard's raw pipeline value"
        />
        <div className="flex items-center gap-2">
          {exportError ? (
            <span className="text-caption text-danger-600 dark:text-danger-400">{exportError}</span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => void handleExport()}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">Forecast by period</h3>
          <Select
            aria-label="Bucket period"
            className="w-40"
            value={period}
            onChange={(event) => setPeriod(event.target.value as BucketPeriod)}
          >
            {BUCKET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <RevenueChart
          type="line"
          data={buckets.map((b) => ({ label: b.period, value: b.value }))}
        />
      </Card>
    </div>
  );
}
