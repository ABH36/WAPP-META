import {
  WorkspaceStatus,
  LeadStatus,
  DealStage,
  ConversationStatus,
  PaymentStatus,
} from "@wapp/shared-types";

export type StatusColorToken = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * THE single place business-state → badge-color logic lives (DS-001 §12 — "so
 * status-color logic exists in exactly one place, never duplicated per screen").
 * Traces to DS-001 §2.1's business-state color mapping table.
 */
export function getStatusColor(
  status: WorkspaceStatus | LeadStatus | DealStage | ConversationStatus | PaymentStatus | string,
): StatusColorToken {
  const positive: string[] = [
    WorkspaceStatus.ACTIVE,
    LeadStatus.WON,
    DealStage.WON,
    PaymentStatus.PAID,
  ];
  const attention: string[] = [
    WorkspaceStatus.TRIAL,
    ConversationStatus.PENDING_CUSTOMER,
    PaymentStatus.PENDING,
  ];
  const negative: string[] = [
    WorkspaceStatus.SUSPENDED,
    WorkspaceStatus.EXPIRED,
    LeadStatus.LOST,
    DealStage.LOST,
    PaymentStatus.FAILED,
  ];
  const neutralInactive: string[] = [
    WorkspaceStatus.CANCELLED,
    ConversationStatus.CLOSED,
    ConversationStatus.ARCHIVED,
    LeadStatus.UNQUALIFIED,
  ];

  if (positive.includes(status)) return "success";
  if (attention.includes(status)) return "warning";
  if (negative.includes(status)) return "danger";
  if (neutralInactive.includes(status)) return "neutral";
  return "info"; // NEW / DRAFT / SCHEDULED and any unmapped value default to informational
}
