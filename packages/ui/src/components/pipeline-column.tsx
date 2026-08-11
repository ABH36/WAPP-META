import * as React from "react";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-5 §4.5/§7 — one Kanban column. Pure layout/drop-zone
 * shell — `onDragOver`/`onDrop` are passed through untouched so
 * `apps/web`'s Pipeline feature owns the actual drag-and-drop and
 * stage-transition call; this component never validates which moves are
 * allowed (BR-007 — that's the backend's job, via the dedicated
 * `PATCH /crm/deals/:id/stage` route).
 */
export interface PipelineColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  count: number;
  totalValue?: string;
  isDropTarget?: boolean;
}

export const PipelineColumn = React.forwardRef<HTMLDivElement, PipelineColumnProps>(
  ({ className, title, count, totalValue, isDropTarget, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 md:w-72 md:shrink-0 dark:border-neutral-800 dark:bg-neutral-900",
          isDropTarget && "border-brand-500 dark:border-brand-500 ring-brand-500/30 ring-2",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {title}
          </span>
          <span className="text-caption rounded-full bg-neutral-200 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {count}
          </span>
        </div>
        {totalValue ? (
          <span className="text-caption text-neutral-500 dark:text-neutral-400">{totalValue}</span>
        ) : null}
        <div className="flex flex-col gap-2 overflow-y-auto">{children}</div>
      </div>
    );
  },
);
PipelineColumn.displayName = "PipelineColumn";
