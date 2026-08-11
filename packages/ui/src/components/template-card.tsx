import * as React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { getStatusColor } from "../lib/status-color";
import { cn } from "../lib/cn";

/** FRD-001 Volume-4 §4.7/§7 — one Template list row. */
export interface TemplateCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  name: string;
  category: string;
  language: string;
  status: string;
  rejectionReason?: string | null;
  onClick?: () => void;
}

export const TemplateCard = React.forwardRef<HTMLDivElement, TemplateCardProps>(
  ({ className, name, category, language, status, rejectionReason, onClick, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        interactive={!!onClick}
        onClick={onClick}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {name}
          </span>
          <Badge variant={getStatusColor(status)}>{status}</Badge>
        </div>
        <div className="text-caption text-neutral-500 dark:text-neutral-400">
          {category} · {language}
        </div>
        {status === "REJECTED" && rejectionReason ? (
          <div className="text-caption text-danger-700 dark:text-danger-500">{rejectionReason}</div>
        ) : null}
      </Card>
    );
  },
);
TemplateCard.displayName = "TemplateCard";
