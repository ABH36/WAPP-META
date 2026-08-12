import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { Switch } from "./switch";
import { cn } from "../lib/cn";

/** FRD-001 Volume-7 §4.9/§7 — one Webhook row. `lastDeliveryAt`/`lastError` are the only delivery-history fields shown — no delivery-log list exists to render (no backing endpoint, see docs/TECH-DEBT.md). */
export interface WebhookCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  url: string;
  status: string;
  enabled: boolean;
  events: string[];
  lastDeliveryAt: string | null;
  lastError: string | null;
  onToggleEnabled?: (enabled: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const WebhookCard = React.forwardRef<HTMLDivElement, WebhookCardProps>(
  (
    {
      className,
      url,
      status,
      enabled,
      events,
      lastDeliveryAt,
      lastError,
      onToggleEnabled,
      onEdit,
      onDelete,
      ...props
    },
    ref,
  ) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-3", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <code className="text-body-sm truncate text-neutral-900 dark:text-neutral-50">{url}</code>
          <div className="flex shrink-0 items-center gap-2">
            <StageBadge value={status} />
            {onToggleEnabled ? (
              <Switch checked={enabled} onCheckedChange={onToggleEnabled} aria-label="Enabled" />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {events.map((event) => (
            <span
              key={event}
              className="text-caption rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            >
              {event}
            </span>
          ))}
        </div>
        <div className="text-caption text-neutral-500 dark:text-neutral-400">
          {lastError
            ? `Last delivery failed: ${lastError}`
            : lastDeliveryAt
              ? `Last delivered ${new Date(lastDeliveryAt).toLocaleString()}`
              : "No deliveries yet"}
        </div>
        {(onEdit ?? onDelete) ? (
          <div className="flex gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-caption text-brand-600 hover:underline"
              >
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="text-caption text-danger-600 dark:text-danger-400 hover:underline"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  },
);
WebhookCard.displayName = "WebhookCard";
