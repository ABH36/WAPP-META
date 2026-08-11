import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-5 §4.3/§7 — one Customers list row. No "Assigned User" field — Customer has no owner concept at all (Architecture Review, 2026-08-11). */
export interface CustomerCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  customerName: string;
  companyName?: string | null;
  status: string;
  mobileNumber: string;
  onClick?: () => void;
}

export const CustomerCard = React.forwardRef<HTMLDivElement, CustomerCardProps>(
  ({ className, customerName, companyName, status, mobileNumber, onClick, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        interactive
        onClick={onClick}
        className={cn("flex cursor-pointer flex-col gap-1", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {customerName}
          </span>
          <StageBadge value={status} />
        </div>
        <div className="text-caption text-neutral-500 dark:text-neutral-400">
          {companyName ? `${companyName} · ` : ""}
          {mobileNumber}
        </div>
      </Card>
    );
  },
);
CustomerCard.displayName = "CustomerCard";
