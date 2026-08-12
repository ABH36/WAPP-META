import * as React from "react";
import { Card } from "./card";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-7 §7 — a reusable section wrapper (title + optional
 * description + optional action slot + content), the first real attempt
 * at DS-001's long-missing "page-section-header" pattern (Volume-3's own
 * doc comment noted no such shared component existed yet — each page
 * composed its own heading locally instead). Used across Settings Home,
 * Preferences, Integrations, and every other new Volume-7 screen so
 * section framing doesn't get re-invented per page.
 */
export interface SettingsSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const SettingsSection = React.forwardRef<HTMLDivElement, SettingsSectionProps>(
  ({ className, title, description, action, children, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-4", className)} {...props}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-h3 text-neutral-900 dark:text-neutral-50">{title}</h3>
            {description ? (
              <p className="text-body-sm mt-1 text-neutral-500 dark:text-neutral-400">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children}
      </Card>
    );
  },
);
SettingsSection.displayName = "SettingsSection";
