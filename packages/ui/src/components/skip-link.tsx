import * as React from "react";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-9 §10 — "Skip to content" link. Visually hidden until
 * keyboard-focused (`sr-only focus:not-sr-only`), so a keyboard/screen-
 * reader user can bypass the Sidebar/Header on every page rather than
 * tabbing through the full nav first. Each app renders exactly one of
 * these as the first focusable element in its root layout, pointing at
 * `href="#main-content"` — the id every app's `<main>` region carries.
 */
export type SkipLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

export function SkipLink({ className, children, ...props }: SkipLinkProps): React.JSX.Element {
  return (
    <a
      className={cn(
        "sr-only focus:not-sr-only",
        "focus:fixed focus:left-4 focus:top-4 focus:z-50",
        "focus:bg-brand-600 focus:rounded-md focus:px-4 focus:py-2 focus:text-white",
        "focus-visible:ring-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children ?? "Skip to main content"}
    </a>
  );
}
