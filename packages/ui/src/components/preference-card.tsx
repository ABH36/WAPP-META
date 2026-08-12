import * as React from "react";
import { cn } from "../lib/cn";

/** FRD-001 Volume-7 §4.4/§7 — one preference row: label + optional description + an arbitrary control slot (Select/Switch/RadioGroup, whatever the specific preference needs). Deliberately generic — Theme/Sidebar/Density/Landing Page/Notifications all render very differently, so this owns only the row layout, never the control itself. */
export interface PreferenceCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  label: string;
  description?: string;
  control: React.ReactNode;
}

export const PreferenceCard = React.forwardRef<HTMLDivElement, PreferenceCardProps>(
  ({ className, label, description, control, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-3 border-b border-neutral-200 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800",
          className,
        )}
        {...props}
      >
        <div>
          <span className="text-body-sm font-medium text-neutral-900 dark:text-neutral-50">
            {label}
          </span>
          {description ? (
            <p className="text-caption text-neutral-500 dark:text-neutral-400">{description}</p>
          ) : null}
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    );
  },
);
PreferenceCard.displayName = "PreferenceCard";
