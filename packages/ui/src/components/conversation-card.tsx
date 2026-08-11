import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { getStatusColor } from "../lib/status-color";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-4 §4.2/§7 — one Inbox list row. No message-content
 * preview ("Last Message" is a timestamp, not a text snippet —
 * `ConversationSummary` has no such field; inventing one would mean an
 * extra per-row fetch the backend doesn't support in one call). No unread
 * badge — no such field exists on the backend either.
 */
export interface ConversationCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onClick"
> {
  contactName: string | null;
  contactPhoneNumber: string | null;
  status: string;
  assignedToLabel?: string;
  lastMessageAt: string;
  active?: boolean;
  onClick?: () => void;
}

export const ConversationCard = React.forwardRef<HTMLDivElement, ConversationCardProps>(
  (
    {
      className,
      contactName,
      contactPhoneNumber,
      status,
      assignedToLabel,
      lastMessageAt,
      active,
      onClick,
      ...props
    },
    ref,
  ) => {
    return (
      <Card
        ref={ref}
        interactive
        onClick={onClick}
        className={cn(
          "flex cursor-pointer flex-col gap-1",
          active && "border-brand-500 dark:border-brand-500",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {contactName ?? contactPhoneNumber ?? "Unknown contact"}
          </span>
          <Badge variant={getStatusColor(status)}>{status}</Badge>
        </div>
        <div className="text-caption flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
          <span>{assignedToLabel ?? "Unassigned"}</span>
          <span>{new Date(lastMessageAt).toLocaleString()}</span>
        </div>
      </Card>
    );
  },
);
ConversationCard.displayName = "ConversationCard";
