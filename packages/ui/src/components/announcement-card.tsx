import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.10/§7 — one Announcement row. No status badge for Active/Scheduled/Expired — that state doesn't exist on the backend; only `targetType` (a real field) is shown as a badge. */
export interface AnnouncementCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  title: string;
  message: string;
  targetType: string;
  createdAt: string;
}

export const AnnouncementCard = React.forwardRef<HTMLDivElement, AnnouncementCardProps>(
  ({ className, title, message, targetType, createdAt, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {title}
          </span>
          <Badge variant="info">{targetType}</Badge>
        </div>
        <p className="text-body-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        <span className="text-caption text-neutral-500 dark:text-neutral-400">
          Created {new Date(createdAt).toLocaleString()}
        </span>
      </Card>
    );
  },
);
AnnouncementCard.displayName = "AnnouncementCard";
