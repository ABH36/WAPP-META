import * as React from "react";
import { Badge } from "./badge";
import type { StatusColorToken } from "../lib/status-color";

/** FRD-001 Volume-5 §4.4/§7 — a 0-100 probability percentage, color-coded by rough band (this component's own scheme, not `getStatusColor` — probability isn't a business-state enum). `probability` is a plain, user-settable Deal field, never backend-calculated (BR-008 — the frontend doesn't compute it either, only picks a display color for whatever number the backend returns). */
export interface ProbabilityBadgeProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  probability: number;
}

function bandFor(probability: number): StatusColorToken {
  if (probability >= 70) return "success";
  if (probability >= 30) return "warning";
  return "danger";
}

export function ProbabilityBadge({
  probability,
  ...props
}: ProbabilityBadgeProps): React.JSX.Element {
  return (
    <Badge variant={bandFor(probability)} {...props}>
      {probability}%
    </Badge>
  );
}
