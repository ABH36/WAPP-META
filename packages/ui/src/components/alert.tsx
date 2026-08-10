import * as React from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * DS-001 §4/§10 — Alert/Banner, variants info/warning/danger, dismissible.
 * FRD-001 Volume-2 §10's distinct error states (Invalid Credentials,
 * Locked Account, Expired Token, Maintenance Mode, Network Failure) all
 * render through this one component — the `variant` + `children` (the
 * backend's own message, per ADR-FE-003) is the only thing that changes
 * per case, never a bespoke component per error type.
 */
const alertVariants = cva("flex items-start gap-3 rounded-md border p-3 text-body-sm", {
  variants: {
    variant: {
      info: "border-info-500/30 bg-info-50 text-info-700 dark:bg-info-500/10 dark:text-info-500",
      warning:
        "border-warning-500/30 bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500",
      danger:
        "border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-500",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = { info: Info, warning: AlertTriangle, danger: AlertCircle } as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  onDismiss?: () => void;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, onDismiss, children, ...props }, ref) => {
    const Icon = ICONS[variant ?? "info"];
    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">{children}</div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  },
);
Alert.displayName = "Alert";
