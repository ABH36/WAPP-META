import * as React from "react";
import { Card } from "./card";
import { ProbabilityBadge } from "./probability-badge";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-5 §4.5/§7 — a compact Kanban tile, distinct from
 * `DealCard` (the fuller Deals list row) — no stage badge (the column
 * itself already conveys stage) and no close-date row, just enough to
 * scan a column at a glance. `draggable`/drag-event props are passed
 * through untouched; the actual HTML5 drag-and-drop wiring lives in
 * `apps/web`'s Pipeline feature, this component only renders the tile.
 */
export interface DealTileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  title: string;
  value: number;
  currency: string;
  probability: number;
  ownerLabel?: string;
  onClick?: () => void;
}

export const DealTile = React.forwardRef<HTMLDivElement, DealTileProps>(
  ({ className, title, value, currency, probability, ownerLabel, onClick, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        interactive
        onClick={onClick}
        className={cn("flex cursor-pointer flex-col gap-1 p-3", className)}
        {...props}
      >
        <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
          {title}
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption text-neutral-600 dark:text-neutral-400">
            {currency} {value.toLocaleString()}
          </span>
          <ProbabilityBadge probability={probability} />
        </div>
        {ownerLabel ? (
          <span className="text-caption text-neutral-500 dark:text-neutral-400">{ownerLabel}</span>
        ) : null}
      </Card>
    );
  },
);
DealTile.displayName = "DealTile";
