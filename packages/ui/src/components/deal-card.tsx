import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { ProbabilityBadge } from "./probability-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-5 §4.4/§7 — one Deals list row. */
export interface DealCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  title: string;
  stage: string;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string | null;
  ownerLabel?: string;
  onClick?: () => void;
}

export const DealCard = React.forwardRef<HTMLDivElement, DealCardProps>(
  (
    {
      className,
      title,
      stage,
      value,
      currency,
      probability,
      expectedCloseDate,
      ownerLabel,
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
        className={cn("flex cursor-pointer flex-col gap-2", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {title}
          </span>
          <StageBadge value={stage} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-h3 text-neutral-900 dark:text-neutral-50">
            {currency} {value.toLocaleString()}
          </span>
          <ProbabilityBadge probability={probability} />
        </div>
        <div className="text-caption flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
          <span>{ownerLabel ?? "Unassigned"}</span>
          <span>
            {expectedCloseDate ? new Date(expectedCloseDate).toLocaleDateString() : "No close date"}
          </span>
        </div>
      </Card>
    );
  },
);
DealCard.displayName = "DealCard";
