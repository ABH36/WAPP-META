import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import type { StatusColorToken } from "../lib/status-color";

/** DS-001 §4/§2.1 — Badge, variants map 1:1 to `StatusColorToken` (getStatusColor's return type), so a badge's color is always driven by the same single status-color mapping, never a separate ad hoc choice. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium",
  {
    variants: {
      variant: {
        success: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500",
        warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500",
        danger: "bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-500",
        info: "bg-info-50 text-info-700 dark:bg-info-500/10 dark:text-info-500",
        neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
      } satisfies Record<StatusColorToken, string>,
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
