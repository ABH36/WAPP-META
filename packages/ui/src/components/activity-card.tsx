import * as React from "react";
import { Phone, Users, Mail, Clock, Bell, StickyNote, CalendarClock } from "lucide-react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

const TYPE_ICON: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-4 w-4" aria-hidden />,
  MEETING: <Users className="h-4 w-4" aria-hidden />,
  EMAIL: <Mail className="h-4 w-4" aria-hidden />,
  TASK: <Clock className="h-4 w-4" aria-hidden />,
  FOLLOW_UP: <CalendarClock className="h-4 w-4" aria-hidden />,
  REMINDER: <Bell className="h-4 w-4" aria-hidden />,
  NOTE: <StickyNote className="h-4 w-4" aria-hidden />,
};

/** FRD-001 Volume-5 §4.6/§4.7/§4.8/§7 — one Activity row, covering every `ActivityType` (Call/Meeting/Email/Task/Follow-up/Reminder/Note) with one component rather than one per type, since they're all the same backend resource (Architecture Review, 2026-08-11). */
export interface ActivityCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  type: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  timestamp: string;
  onClick?: () => void;
}

export const ActivityCard = React.forwardRef<HTMLDivElement, ActivityCardProps>(
  ({ className, type, title, subtitle, statusLabel, timestamp, onClick, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        interactive={!!onClick}
        onClick={onClick}
        className={cn("flex items-start gap-3", onClick && "cursor-pointer", className)}
        {...props}
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {TYPE_ICON[type] ?? <Clock className="h-4 w-4" aria-hidden />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
              {title}
            </span>
            {statusLabel ? <Badge variant="neutral">{statusLabel}</Badge> : null}
          </div>
          {subtitle ? (
            <p className="text-caption text-neutral-500 dark:text-neutral-400">{subtitle}</p>
          ) : null}
          <p className="text-caption text-neutral-400 dark:text-neutral-500">
            {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </Card>
    );
  },
);
ActivityCard.displayName = "ActivityCard";
