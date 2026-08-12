import * as React from "react";
import { cn } from "../lib/cn";
import type { StatusColorToken } from "../lib/status-color";

/**
 * FRD-001 Volume-6 §4.3/§7 — a usage-percentage bar, color-banded by this
 * component's own scheme (not `getStatusColor` — a percentage isn't a
 * business-state enum, same reasoning as `ProbabilityBadge`), matching the
 * backend's own `USAGE_WARNING_THRESHOLDS = [80, 90, 100]`
 * (`@wapp/shared-types`) — 80%+ warns, 100%+ (or `locked`) reads as danger.
 * `percentage: null` means the backend has no limit set for this counter
 * yet (TD-014, pending commercial approval) — rendered as "No limit set"
 * text, never a fabricated 0% bar.
 */
export interface UsageProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  percentage: number | null;
  locked?: boolean;
}

const BAR_COLOR: Record<StatusColorToken, string> = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
  neutral: "bg-neutral-400",
};

function bandFor(percentage: number, locked: boolean): StatusColorToken {
  if (locked || percentage >= 100) return "danger";
  if (percentage >= 80) return "warning";
  return "success";
}

export const UsageProgress = React.forwardRef<HTMLDivElement, UsageProgressProps>(
  ({ percentage, locked = false, className, ...props }, ref) => {
    if (percentage === null) {
      return (
        <div
          ref={ref}
          className={cn("text-caption text-neutral-500 dark:text-neutral-400", className)}
          {...props}
        >
          No limit set
        </div>
      );
    }

    const clamped = Math.min(Math.max(percentage, 0), 100);
    const band = bandFor(percentage, locked);

    return (
      <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={cn("h-full rounded-full transition-all", BAR_COLOR[band])}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {locked ? (
          <span className="text-caption text-danger-600 dark:text-danger-400">
            Locked — limit reached
          </span>
        ) : null}
      </div>
    );
  },
);
UsageProgress.displayName = "UsageProgress";
