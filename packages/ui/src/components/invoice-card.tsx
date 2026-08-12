import * as React from "react";
import { Card } from "./card";
import { StageBadge } from "./stage-badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-6 §4.4/§7 — one Invoices list row. `amount`/`tax` are nullable until GTM pricing/tax approval (TD-009/TD-011) — rendered as "Pricing pending", never `₹0`. */
export interface InvoiceCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  invoiceNumber: string;
  status: string;
  amount: number | null;
  currency: string;
  dueDate: string;
  issuedAt: string;
  onClick?: () => void;
}

export const InvoiceCard = React.forwardRef<HTMLDivElement, InvoiceCardProps>(
  (
    { className, invoiceNumber, status, amount, currency, dueDate, issuedAt, onClick, ...props },
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
            {invoiceNumber}
          </span>
          <StageBadge value={status} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-h3 text-neutral-900 dark:text-neutral-50">
            {amount !== null ? `${currency} ${amount.toLocaleString()}` : "Pricing pending"}
          </span>
        </div>
        <div className="text-caption flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
          <span>Issued {new Date(issuedAt).toLocaleDateString()}</span>
          <span>Due {new Date(dueDate).toLocaleDateString()}</span>
        </div>
      </Card>
    );
  },
);
InvoiceCard.displayName = "InvoiceCard";
