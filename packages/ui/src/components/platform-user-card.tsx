import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.3/§7 — one Platform User row. No "Reset Password" action — no backend route exists for it (see docs/TECH-DEBT.md). */
export interface PlatformUserCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  actions?: React.ReactNode;
}

export const PlatformUserCard = React.forwardRef<HTMLDivElement, PlatformUserCardProps>(
  ({ className, fullName, email, role, isActive, lastLoginAt, actions, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {fullName}
          </span>
          <Badge variant={isActive ? "success" : "neutral"}>
            {isActive ? "ACTIVE" : "INACTIVE"}
          </Badge>
        </div>
        <span className="text-caption text-neutral-500 dark:text-neutral-400">{email}</span>
        <div className="text-caption flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-500 dark:text-neutral-400">
          <span>Role: {role}</span>
          <span>
            {lastLoginAt
              ? `Last login ${new Date(lastLoginAt).toLocaleString()}`
              : "Never logged in"}
          </span>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </Card>
    );
  },
);
PlatformUserCard.displayName = "PlatformUserCard";
