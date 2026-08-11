import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-5 §4.2/§7 — one Leads list row. "Last Activity" is deliberately absent — no such field exists on Lead (Architecture Review, 2026-08-11). */
export interface LeadCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  leadName: string;
  status: string;
  source: string;
  ownerLabel?: string;
  createdAt: string;
  converted?: boolean;
  onClick?: () => void;
}

export const LeadCard = React.forwardRef<HTMLDivElement, LeadCardProps>(
  (
    { className, leadName, status, source, ownerLabel, createdAt, converted, onClick, ...props },
    ref,
  ) => {
    return (
      <Card
        ref={ref}
        interactive
        onClick={onClick}
        className={cn("flex cursor-pointer flex-col gap-1", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {leadName}
          </span>
          <StageBadge value={status} />
        </div>
        <div className="text-caption flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
          <span>
            {source} · {ownerLabel ?? "Unassigned"}
            {converted ? " · Converted" : ""}
          </span>
          <span>{new Date(createdAt).toLocaleDateString()}</span>
        </div>
      </Card>
    );
  },
);
LeadCard.displayName = "LeadCard";
