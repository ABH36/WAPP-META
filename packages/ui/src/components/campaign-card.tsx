import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { getStatusColor } from "../lib/status-color";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-4 §4.6/§7 — one Campaign list row. Distinct from
 * `BroadcastCard` (not named in the original FRD's §7 list, added because
 * the Architecture Review, 2026-08-11, required Broadcasts and Campaigns
 * to be exposed as the two separate backend resources they actually are)
 * — a Campaign additionally surfaces `waveCount` (how many Broadcasts it
 * orchestrates), which a standalone Broadcast has no equivalent of.
 */
export interface CampaignCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  name: string;
  status: string;
  waveCount?: number;
  sentCount?: number;
  totalCount?: number;
  onClick?: () => void;
}

export const CampaignCard = React.forwardRef<HTMLDivElement, CampaignCardProps>(
  ({ className, name, status, waveCount, sentCount, totalCount, onClick, ...props }, ref) => {
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
          {waveCount !== undefined ? `${waveCount} wave${waveCount === 1 ? "" : "s"}` : null}
          {totalCount !== undefined ? ` · Send progress: ${sentCount ?? 0}/${totalCount}` : null}
        </div>
      </Card>
    );
  },
);
CampaignCard.displayName = "CampaignCard";
