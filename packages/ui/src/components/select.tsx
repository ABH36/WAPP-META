import * as React from "react";
import { cn } from "../lib/cn";

/** DS-001 §4 — Select, shadcn `select` base (native `<select>` variant — the searchable/Combobox variant DS-001 names for Customer/Lead pickers is not needed by any screen yet and stays deferred). Styled to match `Input` exactly (height, border, focus ring, error state). */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "bg-neutral-0 text-body duration-micro h-9 w-full rounded-md border px-3 text-neutral-900 transition-colors",
          "focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "dark:bg-neutral-950 dark:text-neutral-50",
          error
            ? "border-danger-500 focus-visible:ring-danger-500"
            : "border-neutral-300 dark:border-neutral-700",
          className,
        )}
        aria-invalid={error}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";
