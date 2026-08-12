import * as React from "react";
import { Badge } from "./badge";
import { Card } from "./card";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-6 §4.2/§7 — one Plan option (Subscription's Upgrade/
 * Downgrade picker). `monthlyPrice`/`yearlyPrice` are nullable until GTM
 * pricing is formally approved (TD-009) — rendered as "Contact us for
 * pricing", never a fabricated `₹0` (a real business meaning the backend
 * itself refuses to seed, per `plan.schema.ts`'s own doc comment).
 */
export interface PlanCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  name: string;
  description?: string | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  isCurrent?: boolean;
  actionLabel?: string;
  onSelect?: () => void;
}

export const PlanCard = React.forwardRef<HTMLDivElement, PlanCardProps>(
  (
    {
      className,
      name,
      description,
      monthlyPrice,
      yearlyPrice,
      currency,
      isCurrent = false,
      actionLabel,
      onSelect,
      ...props
    },
    ref,
  ) => {
    return (
      <Card
        ref={ref}
        interactive={!!onSelect && !isCurrent}
        onClick={!isCurrent ? onSelect : undefined}
        className={cn(
          "flex flex-col gap-2",
          !isCurrent && onSelect && "cursor-pointer",
          isCurrent && "border-brand-500 dark:border-brand-500",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-h3 text-neutral-900 dark:text-neutral-50">{name}</span>
          {isCurrent ? <Badge variant="success">Current Plan</Badge> : null}
        </div>
        {description ? (
          <p className="text-body-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        ) : null}
        <div className="text-body-sm text-neutral-500 dark:text-neutral-400">
          {monthlyPrice !== null ? (
            <span>
              {currency} {monthlyPrice.toLocaleString()}/mo
            </span>
          ) : (
            <span>Contact us for pricing</span>
          )}
          {yearlyPrice !== null ? (
            <span>
              {" "}
              · {currency} {yearlyPrice.toLocaleString()}/yr
            </span>
          ) : null}
        </div>
        {!isCurrent && actionLabel ? (
          <span className="text-body-sm text-brand-600 font-medium">{actionLabel}</span>
        ) : null}
      </Card>
    );
  },
);
PlanCard.displayName = "PlanCard";
