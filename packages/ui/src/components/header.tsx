import * as React from "react";
import { cn } from "../lib/cn";

/**
 * DS-001 §4/§5 — Header/Topbar, "custom" base, variants `app`/`marketing`.
 * A pure layout shell: left/center/right slots. Each app supplies its own
 * nav content (workspace switcher vs tenant search, per DS-001 §5's
 * Platform-Administration row) — this component never hardcodes app-specific
 * navigation, only the structural region.
 */
export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ className, left, center, right, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          "bg-neutral-0 flex h-14 items-center justify-between gap-4 border-b border-neutral-200 px-4 dark:border-neutral-800 dark:bg-neutral-950",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-3">{left}</div>
        <div className="flex flex-1 items-center justify-center">{center}</div>
        <div className="flex items-center gap-3">{right}</div>
      </header>
    );
  },
);
Header.displayName = "Header";
