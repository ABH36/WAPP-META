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
 *
 * FRD-001 Volume-4 — Communication's real status values (Conversation,
 * Broadcast, Campaign, Template) are added below as raw string literals,
 * not typed enum members. Architecture Review, 2026-08-11, found
 * `@wapp/shared-types`'s `ConversationStatus` has drifted from what
 * `apps/api`'s Communication module actually returns (`PENDING_CUSTOMER`
 * vs. the real `PENDING`), and `BroadcastStatus`/`CampaignStatus`/
 * `TemplateStatus` either don't exist in the shared package or also
 * differ — see docs/TECH-DEBT.md. `apps/web`'s own local types
 * (`types/conversation.ts` etc.) mirror the real backend instead of the
 * drifted package, and `packages/ui` can't import those app-local types
 * (wrong dependency direction), so the real values are added here as
 * plain strings, relying on this function's existing `| string` fallback.
 */
export function getStatusColor(
  status: WorkspaceStatus | LeadStatus | DealStage | ConversationStatus | PaymentStatus | string,
): StatusColorToken {
  const positive: string[] = [
    WorkspaceStatus.ACTIVE,
    LeadStatus.WON,
    DealStage.WON,
    PaymentStatus.PAID,
    "RESOLVED", // Conversation (real value)
    "APPROVED", // Template
    "COMPLETED", // Broadcast / Campaign
  ];
  const attention: string[] = [
    WorkspaceStatus.TRIAL,
    ConversationStatus.PENDING_CUSTOMER,
    PaymentStatus.PENDING,
    "PENDING", // Conversation (real value) / Template
    "RUNNING", // Broadcast
    "SCHEDULED", // Broadcast
    "PAUSED", // Broadcast / Template
  ];
  const negative: string[] = [
    WorkspaceStatus.SUSPENDED,
    WorkspaceStatus.EXPIRED,
    LeadStatus.LOST,
    DealStage.LOST,
    PaymentStatus.FAILED,
    "SPAM", // Conversation
    "REJECTED", // Template
    "FAILED", // Broadcast
  ];
  const neutralInactive: string[] = [
    WorkspaceStatus.CANCELLED,
    ConversationStatus.CLOSED,
    ConversationStatus.ARCHIVED,
    LeadStatus.UNQUALIFIED,
    "CANCELLED", // Broadcast / Campaign
    "DISABLED", // Template
  ];

  if (positive.includes(status)) return "success";
  if (attention.includes(status)) return "warning";
  if (negative.includes(status)) return "danger";
  if (neutralInactive.includes(status)) return "neutral";
  return "info"; // NEW / OPEN / ASSIGNED / DRAFT and any unmapped value default to informational
}
