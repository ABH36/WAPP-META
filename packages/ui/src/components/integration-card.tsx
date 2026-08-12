import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-7 §4.7/§7 — one integration's status card (WhatsApp/Email/a third-party app). `status` renders via the existing `StageBadge`/`getStatusColor` — no new badge component needed. `actions` is a free slot (Disconnect/Test Connection/Refresh Metadata/Enable buttons vary per integration type, since there's no generic Integration CRUD model on the backend). */
export interface IntegrationCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  name: string;
  status: string;
  description?: string;
  actions?: React.ReactNode;
}

export const IntegrationCard = React.forwardRef<HTMLDivElement, IntegrationCardProps>(
  ({ className, name, status, description, actions, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-3", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {name}
          </span>
          <StageBadge value={status} />
        </div>
        {description ? (
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400">{description}</p>
        ) : null}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </Card>
    );
  },
);
IntegrationCard.displayName = "IntegrationCard";
