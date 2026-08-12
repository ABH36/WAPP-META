import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-7 §4.11/§7 — one Export Job row. `resultUrl` is a direct Storage link (no proxied API download exists) — the "Download" affordance is a plain anchor the caller renders itself via `onDownload`/`href`, not a fetch-then-save flow. */
export interface ExportJobCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  entityType: string;
  format: string;
  status: string;
  createdAt: string;
  resultUrl?: string | null;
  error?: string | null;
}

export const ExportJobCard = React.forwardRef<HTMLDivElement, ExportJobCardProps>(
  ({ className, entityType, format, status, createdAt, resultUrl, error, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
            {entityType} · {format}
          </span>
          <StageBadge value={status} />
        </div>
        <span className="text-caption text-neutral-500 dark:text-neutral-400">
          Requested {new Date(createdAt).toLocaleString()}
        </span>
        {error ? (
          <span className="text-caption text-danger-600 dark:text-danger-400">{error}</span>
        ) : resultUrl ? (
          <a
            href={resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-brand-600 w-fit hover:underline"
          >
            Download →
          </a>
        ) : null}
      </Card>
    );
  },
);
ExportJobCard.displayName = "ExportJobCard";
