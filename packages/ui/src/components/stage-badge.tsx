import * as React from "react";
import { Badge } from "./badge";
import { getStatusColor } from "../lib/status-color";

/** FRD-001 Volume-5 §4.4/§4.5/§7 — wraps the existing `Badge`/`getStatusColor` mapping for any CRM status/stage string (`DealStage`, `LeadStatus`, `CustomerStatus`), same pattern as `WorkspaceStatusBadge`. Renders the raw value as its label — callers pass an already-human-formatted string if a nicer label is wanted. */
export interface StageBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  value: string;
  label?: string;
}

export function StageBadge({ value, label, ...props }: StageBadgeProps): React.JSX.Element {
  return (
    <Badge variant={getStatusColor(value)} {...props}>
      {label ?? value}
    </Badge>
  );
}
