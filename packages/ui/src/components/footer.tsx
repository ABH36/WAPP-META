import * as React from "react";
import { cn } from "../lib/cn";

/** DS-001 §4 — Footer, variant `marketing` only ("not present inside the authenticated app"). apps/admin never imports this. */
export type FooterProps = React.HTMLAttributes<HTMLElement>;

export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <footer
        ref={ref}
        className={cn(
          "text-body-sm border-t border-neutral-200 bg-neutral-50 py-8 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
          className,
        )}
        {...props}
      >
        <div className="mx-auto max-w-[1280px] px-4">{children}</div>
      </footer>
    );
  },
);
Footer.displayName = "Footer";
