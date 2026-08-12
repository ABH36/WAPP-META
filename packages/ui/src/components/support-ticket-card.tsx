import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.5/§7 — one Support Ticket row. Carries only `workspaceId` (a label the caller resolves separately) — no embedded workspace/billing summary exists on the ticket itself (BR-005). */
export interface SupportTicketCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onClick"
> {
  title: string;
  workspaceLabel: string;
  category: string;
  priority: string;
  status: string;
  assignedOperator: string | null;
  onClick?: () => void;
}

export const SupportTicketCard = React.forwardRef<HTMLDivElement, SupportTicketCardProps>(
  (
    {
      className,
      title,
      workspaceLabel,
      category,
      priority,
      status,
      assignedOperator,
      onClick,
      ...props
    },
    ref,
  ) => {
    return (
      <Card
        ref={ref}
        interactive={!!onClick}
        onClick={onClick}
        className={cn("flex flex-col gap-2", onClick && "cursor-pointer", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {title}
          </span>
          <div className="flex items-center gap-2">
            <StageBadge value={priority} />
            <StageBadge value={status} />
          </div>
        </div>
        <div className="text-caption flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-500 dark:text-neutral-400">
          <span>{workspaceLabel}</span>
          <span>{category}</span>
          <span>{assignedOperator ? `Assigned to ${assignedOperator}` : "Unassigned"}</span>
        </div>
      </Card>
    );
  },
);
SupportTicketCard.displayName = "SupportTicketCard";
