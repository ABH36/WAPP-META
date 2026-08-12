import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.11/§7 — one Feature Flag row. `enabled: null` is a genuine third state ("Inherit" — no platform override, falls back to the workspace-level default), not just on/off; rendered as its own neutral badge, never coerced to a boolean. No per-workspace override slot exists (single global tier only). */
export interface FeatureFlagCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  flagKey: string;
  enabled: boolean | null;
  actions?: React.ReactNode;
}

export const FeatureFlagCard = React.forwardRef<HTMLDivElement, FeatureFlagCardProps>(
  ({ className, flagKey, enabled, actions, ...props }, ref) => {
    const label = enabled === null ? "Inherit" : enabled ? "Enabled" : "Disabled";
    const variant = enabled === null ? "neutral" : enabled ? "success" : "danger";
    return (
      <Card
        ref={ref}
        className={cn("flex flex-wrap items-center justify-between gap-2", className)}
        {...props}
      >
        <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
          {flagKey}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={variant}>{label}</Badge>
          {actions}
        </div>
      </Card>
    );
  },
);
FeatureFlagCard.displayName = "FeatureFlagCard";
