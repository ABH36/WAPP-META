import * as React from "react";
import { cn } from "../lib/cn";

/**
 * DS-001 §4 — Table, "custom data-table" base. This is the minimal
 * primitive set (structure only, no sorting/filtering/pagination logic) —
 * a full data-table with those features is CRM's own future concern
 * (Customers/Leads/Deals lists), not something FRD-001 Volume-2's
 * read-only Login History table needs.
 */
export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>): React.JSX.Element {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("text-body-sm w-full border-collapse", className)} {...props} />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <thead
      className={cn("border-b border-neutral-200 text-left dark:border-neutral-800", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return <tbody className={cn(className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>): React.JSX.Element {
  return (
    <tr
      className={cn("border-b border-neutral-100 last:border-0 dark:border-neutral-900", className)}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th
      className={cn(
        "text-caption px-3 py-2 font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <td className={cn("px-3 py-2 text-neutral-700 dark:text-neutral-300", className)} {...props} />
  );
}
