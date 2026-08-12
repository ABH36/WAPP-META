import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-6 §4.5/§7 — one Payments list row. View-only surface — no action props (§4.5: payment recording stays out of this UI, TD-010). */
export interface PaymentCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  gateway: string;
  gatewayReference: string;
  status: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  onClick?: () => void;
}

export const PaymentCard = React.forwardRef<HTMLDivElement, PaymentCardProps>(
  (
    { className, gateway, gatewayReference, status, amount, currency, paidAt, onClick, ...props },
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
            {gateway}
          </span>
          <StageBadge value={status} />
        </div>
        <span className="text-h3 text-neutral-900 dark:text-neutral-50">
          {currency} {amount.toLocaleString()}
        </span>
        <div className="text-caption flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
          <span>{gatewayReference}</span>
          <span>{paidAt ? new Date(paidAt).toLocaleDateString() : "Not yet paid"}</span>
        </div>
      </Card>
    );
  },
);
PaymentCard.displayName = "PaymentCard";
