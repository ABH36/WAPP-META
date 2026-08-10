import * as React from "react";
import { cn } from "../lib/cn";

/**
 * DS-001 §4/§8 — Empty State, "with-illustration"/"with-CTA" variants:
 * "icon + one-sentence explanation + primary CTA... never a blank page."
 * Reused directly for 404/error pages (§8/§13 of FRD-001) — same shape,
 * different icon/copy, not a separate component.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="text-neutral-400 dark:text-neutral-600">{icon}</div> : null}
      <h2 className="text-h3 text-neutral-900 dark:text-neutral-50">{title}</h2>
      {description ? (
        <p className="text-body max-w-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
