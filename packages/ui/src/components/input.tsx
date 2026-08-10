import * as React from "react";
import { cn } from "../lib/cn";

/** DS-001 §4 — Input, shadcn `input` base. Variants: default, with-icon, with-addon. Error state = `danger-500` border + helper text (rendered by the caller, e.g. react-hook-form's field error — this component only exposes the `error` boolean for styling). */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leadingIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leadingIcon, ...props }, ref) => {
    return (
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            "bg-neutral-0 text-body duration-micro h-9 w-full rounded-md border px-3 text-neutral-900 transition-colors placeholder:text-neutral-400",
            "focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500",
            error
              ? "border-danger-500 focus-visible:ring-danger-500"
              : "border-neutral-300 dark:border-neutral-700",
            leadingIcon && "pl-9",
            className,
          )}
          aria-invalid={error}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";
