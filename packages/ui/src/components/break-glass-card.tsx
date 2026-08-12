import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.6/§7 — one Break-Glass request/session row. No "Reject" action slot exists by design — a REQUESTED session can only be approved (no backend route to decline one). */
export interface BreakGlassCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  workspaceLabel: string;
  requestedBy: string;
  reason: string;
  durationMinutes: number;
  status: string;
  expiresAt: string | null;
  actions?: React.ReactNode;
}

export const BreakGlassCard = React.forwardRef<HTMLDivElement, BreakGlassCardProps>(
  (
    {
      className,
      workspaceLabel,
      requestedBy,
      reason,
      durationMinutes,
      status,
      expiresAt,
      actions,
      ...props
    },
    ref,
  ) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {workspaceLabel}
          </span>
          <StageBadge value={status} />
        </div>
        <p className="text-body-sm text-neutral-600 dark:text-neutral-400">{reason}</p>
        <div className="text-caption flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-500 dark:text-neutral-400">
          <span>Requested by {requestedBy}</span>
          <span>{durationMinutes} min</span>
          {expiresAt ? <span>Expires {new Date(expiresAt).toLocaleString()}</span> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </Card>
    );
  },
);
BreakGlassCard.displayName = "BreakGlassCard";
