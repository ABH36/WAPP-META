import * as React from "react";
import { cn } from "../lib/cn";

/** DS-001 §4 — Switch, shadcn `switch` base ("Notification toggles, feature flags" — its named use case, first exercised by FRD-001 Volume-3's Notification Settings screen). A plain controlled `role="switch"` button, not a wrapped native checkbox — matches the visual thumb/track pattern every shadcn/Radix Switch implementation uses. */
export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "duration-micro relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-40",
          checked ? "bg-brand-600" : "bg-neutral-300 dark:bg-neutral-700",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "duration-micro inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";
