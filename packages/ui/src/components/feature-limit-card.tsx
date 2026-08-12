import * as React from "react";
import { Card } from "./card";
import { UsageProgress } from "./usage-progress";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-6 §4.3/§7 — one per-counter row on the Usage & Limits
 * screen: label + count/limit text + `UsageProgress` bar. Covers both
 * "UsageCard" and "FeatureLimitCard" as named in §7 — they describe the
 * same presentational shape (one feature/counter's usage at a glance), so
 * only one component was built, matching the precedent set by CRM's
 * `ReportCard`/`ForecastCard` (FRD-001 Volume-5, reused `SummaryCard`
 * instead of building both named components separately).
 */
export interface FeatureLimitCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  label: string;
  count: number;
  limit: number | null;
  percentage: number | null;
  locked?: boolean;
}

export const FeatureLimitCard = React.forwardRef<HTMLDivElement, FeatureLimitCardProps>(
  ({ className, label, count, limit, percentage, locked = false, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
            {label}
          </span>
          <span className="text-caption text-neutral-500 dark:text-neutral-400">
            {count.toLocaleString()}
            {limit !== null ? ` / ${limit.toLocaleString()}` : ""}
          </span>
        </div>
        <UsageProgress percentage={percentage} locked={locked} />
      </Card>
    );
  },
);
FeatureLimitCard.displayName = "FeatureLimitCard";
