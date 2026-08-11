import * as React from "react";
import { Card } from "./card";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-3 §4.8/§7 — Workspace Summary Card. A pure navigation
 * widget (icon, label, one headline value, optional secondary line, an
 * optional link) — no dashboard logic lives here, matching §4.8's "these
 * are navigation summaries only, no duplicated dashboard logic" rule.
 * Each app-specific summary composition (Subscription/Billing/CRM cards)
 * passes its own already-fetched data in as props; this component never
 * calls a service itself.
 */
export interface SummaryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
}

export const SummaryCard = React.forwardRef<HTMLDivElement, SummaryCardProps>(
  ({ className, icon, label, value, description, href, ...props }, ref) => {
    const content = (
      <Card
        ref={ref}
        interactive={!!href}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          {icon}
          <span className="text-caption font-medium uppercase tracking-wide">{label}</span>
        </div>
        <div className="text-h2 text-neutral-900 dark:text-neutral-50">{value}</div>
        {description ? (
          <div className="text-caption text-neutral-500 dark:text-neutral-400">{description}</div>
        ) : null}
      </Card>
    );

    if (href) {
      return (
        <a href={href} className="block no-underline">
          {content}
        </a>
      );
    }

    return content;
  },
);
SummaryCard.displayName = "SummaryCard";
