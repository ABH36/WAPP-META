import * as React from "react";
import { Alert } from "./alert";
import { cn } from "../lib/cn";

/** FRD-001 Volume-8 §4.12/§7 — the current platform-wide Maintenance Mode status. No "Started By"/"Started At" fields are rendered — persisted in Mongo but never returned by the API this screen reads from. */
export interface MaintenanceBannerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  enabled: boolean;
  reason: string | null;
}

export function MaintenanceBanner({
  className,
  enabled,
  reason,
  ...props
}: MaintenanceBannerProps): React.JSX.Element {
  return (
    <Alert variant={enabled ? "danger" : "info"} className={cn(className)} {...props}>
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {enabled ? "Maintenance Mode is ENABLED" : "Platform is operating normally"}
        </span>
        {enabled && reason ? <span className="text-body-sm">{reason}</span> : null}
      </div>
    </Alert>
  );
}
