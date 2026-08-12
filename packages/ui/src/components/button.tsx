import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Canonical Button component — DS-001 §4. This is the reference pattern every
 * other component in this package follows: cva for variants, forwardRef, DS-001
 * token classes only (never a raw hex/px value inline).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body font-medium " +
    "transition-colors duration-micro ease-out disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // FRD-001 Volume-9 §4.2/ADR-FE-017 — bg-brand-500/danger-500 with
        // white text measured 4.47:1 / 3.76:1 (computed via WCAG relative
        // luminance), both below the 4.5:1 AA threshold for this
        // non-large button text. Moved one/two stops darker on their
        // existing scales — no new color tokens — every combination below
        // is ≥6.29:1 (see docs/ADR-FE-017-production-frontend-strategy.md).
        primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
        secondary:
          "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700",
        ghost:
          "bg-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
        destructive: "bg-danger-700 text-white hover:brightness-90 active:brightness-75",
        link: "bg-transparent text-brand-600 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-body-sm",
        md: "h-9 px-4",
        lg: "h-10 px-6 text-body-lg",
        icon: "h-8 w-8 p-0", // meets DS-001's 32x32 min hit target for icon-only buttons
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
