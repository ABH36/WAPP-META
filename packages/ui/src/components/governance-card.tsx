import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.8/§7 — one Governance Policy row. No "Violations" field/slot exists — that concept has no backend support anywhere. `version`/`updatedBy` reflect the real per-key upsert history; an unset policy (never PATCHed) renders with `version={0}` and no `updatedBy`. */
export interface GovernanceCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  policyKey: string;
  isSet: boolean;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
  action?: React.ReactNode;
}

export const GovernanceCard = React.forwardRef<HTMLDivElement, GovernanceCardProps>(
  ({ className, policyKey, isSet, version, updatedBy, updatedAt, action, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {policyKey}
          </span>
          <Badge variant={isSet ? "info" : "neutral"}>{isSet ? `v${version}` : "Unset"}</Badge>
        </div>
        <span className="text-caption text-neutral-500 dark:text-neutral-400">
          {isSet && updatedBy && updatedAt
            ? `Last updated by ${updatedBy} on ${new Date(updatedAt).toLocaleString()}`
            : "No value has been set yet"}
        </span>
        {action ? <div>{action}</div> : null}
      </Card>
    );
  },
);
GovernanceCard.displayName = "GovernanceCard";
