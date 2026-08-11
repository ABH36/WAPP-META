import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { getStatusColor } from "../lib/status-color";
import { cn } from "../lib/cn";

/** FRD-001 Volume-4 §4.6/§7 — one Broadcast (or Campaign wave) list row. `sentCount`/`totalCount` describe send-attempt progress only ("Layer 1" — accepted-by-Meta counts), never delivered/read, since that data doesn't exist in the API yet. */
export interface BroadcastCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  name: string;
  status: string;
  scheduledAt?: string | null;
  sentCount?: number;
  totalCount?: number;
  onClick?: () => void;
}

export const BroadcastCard = React.forwardRef<HTMLDivElement, BroadcastCardProps>(
  ({ className, name, status, scheduledAt, sentCount, totalCount, onClick, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        interactive={!!onClick}
        onClick={onClick}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {name}
          </span>
          <Badge variant={getStatusColor(status)}>{status}</Badge>
        </div>
        <div className="text-caption text-neutral-500 dark:text-neutral-400">
          {scheduledAt ? `Scheduled ${new Date(scheduledAt).toLocaleString()}` : "Not scheduled"}
          {totalCount !== undefined ? ` · Send progress: ${sentCount ?? 0}/${totalCount}` : null}
        </div>
      </Card>
    );
  },
);
BroadcastCard.displayName = "BroadcastCard";
