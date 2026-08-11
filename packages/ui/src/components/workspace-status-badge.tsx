import * as React from "react";
import { WorkspaceStatus } from "@wapp/shared-types";
import { Badge } from "./badge";
import { getStatusColor } from "../lib/status-color";

const STATUS_LABELS: Record<WorkspaceStatus, string> = {
  [WorkspaceStatus.TRIAL]: "Trial",
  [WorkspaceStatus.ACTIVE]: "Active",
  [WorkspaceStatus.EXPIRED]: "Expired",
  [WorkspaceStatus.SUSPENDED]: "Suspended",
  [WorkspaceStatus.CANCELLED]: "Cancelled",
  [WorkspaceStatus.ARCHIVED]: "Archived",
};

/** FRD-001 Volume-3 §4.7 — read-only status display, wrapping the existing `Badge`/`getStatusColor` mapping (already handles `WorkspaceStatus`, DS-001 §2.1) rather than introducing a second color-mapping scheme. No transition affordance of any kind — Workspace Status is backend-owned end to end (BR-002). */
export interface WorkspaceStatusBadgeProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  status: WorkspaceStatus;
}

export function WorkspaceStatusBadge({
  status,
  ...props
}: WorkspaceStatusBadgeProps): React.JSX.Element {
  return (
    <Badge variant={getStatusColor(status)} {...props}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
