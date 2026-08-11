import * as React from "react";
import { cn } from "../lib/cn";

/** DS-001 §4 — Textarea, shadcn `textarea` base. Styled to match `Input` exactly (border, focus ring, error state), just multi-line. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "bg-neutral-0 text-body duration-micro min-h-20 w-full rounded-md border px-3 py-2 text-neutral-900 transition-colors placeholder:text-neutral-400",
          "focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-500",
          error
            ? "border-danger-500 focus-visible:ring-danger-500"
            : "border-neutral-300 dark:border-neutral-700",
          className,
        )}
        aria-invalid={error}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
