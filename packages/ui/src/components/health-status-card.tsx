import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

/** FRD-001 Volume-7 §4.12/§7 — one Diagnostics check row (Database/Redis/Queue/Storage/Email/WhatsApp). Read-only — no actions, matching BR-007 (Diagnostics remain read-only). */
export interface HealthStatusCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  name: string;
  status: "UP" | "DOWN";
}

export const HealthStatusCard = React.forwardRef<HTMLDivElement, HealthStatusCardProps>(
  ({ className, name, status, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn("flex items-center justify-between gap-2", className)}
        {...props}
      >
        <span className="text-body-sm font-medium capitalize text-neutral-900 dark:text-neutral-50">
          {name}
        </span>
        <Badge variant={status === "UP" ? "success" : "danger"}>{status}</Badge>
      </Card>
    );
  },
);
HealthStatusCard.displayName = "HealthStatusCard";
