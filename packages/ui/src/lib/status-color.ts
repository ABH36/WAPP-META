import {
  WorkspaceStatus,
  LeadStatus,
  DealStage,
  ConversationStatus,
  PaymentStatus,
  SubscriptionStatus,
  InvoiceStatus,
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
 *
 * FRD-001 Volume-5 — CRM's `LeadStatus`/`DealStage` WON/LOST/UNQUALIFIED
 * already had entries from earlier volumes; `CustomerStatus.ARCHIVED`
 * ("ARCHIVED") already matches via `ConversationStatus.ARCHIVED`'s
 * existing entry (same string, no new line needed). Only
 * `CustomerStatus.BLOCKED` is genuinely new here.
 *
 * FRD-001 Volume-6 — Billing's `SubscriptionStatus.{ACTIVE,TRIAL,
 * SUSPENDED,CANCELLED}` and `InvoiceStatus.PAID` all already match
 * existing bucket entries via the same string values (`WorkspaceStatus`/
 * `PaymentStatus`) — no new lines needed for those five.
 * `SubscriptionStatus.GRACE_PERIOD`, `InvoiceStatus.{ISSUED,VOID,
 * REFUNDED}`, and `PaymentStatus.{PARTIALLY_REFUNDED,CHARGEBACK}` are
 * genuinely new. `InvoiceStatus.DRAFT` is deliberately left unmapped —
 * it's never actually produced by any backend code path (forward-
 * compatibility scaffolding only) and already falls through to the
 * existing "info" default correctly.
 *
 * FRD-001 Volume-7 — Settings' `IntegrationConnectionStatus`/
 * `WhatsAppConnectionStatus` (local to `apps/api`'s Settings/Communication
 * modules, no `@wapp/shared-types` equivalent, same reasoning as
 * Communication's Volume-4 real-value strings) add `"CONNECTED"`/
 * `"DISCONNECTED"`/`"ERROR"` as raw strings. `"EXPIRED"` already matches
 * `WorkspaceStatus.EXPIRED`'s existing danger-bucket entry — no new line
 * needed for it.
 */
export function getStatusColor(
  status:
    | WorkspaceStatus
    | LeadStatus
    | DealStage
    | ConversationStatus
    | PaymentStatus
    | SubscriptionStatus
    | InvoiceStatus
    | string,
): StatusColorToken {
  const positive: string[] = [
    WorkspaceStatus.ACTIVE,
    LeadStatus.WON,
    DealStage.WON,
    PaymentStatus.PAID,
    "RESOLVED", // Conversation (real value)
    "APPROVED", // Template
    "COMPLETED", // Broadcast / Campaign
    "CONNECTED", // Settings Integrations/Webhooks
  ];
  const attention: string[] = [
    WorkspaceStatus.TRIAL,
    ConversationStatus.PENDING_CUSTOMER,
    PaymentStatus.PENDING,
    "PENDING", // Conversation (real value) / Template
    "RUNNING", // Broadcast
    "SCHEDULED", // Broadcast
    "PAUSED", // Broadcast / Template
    "BLOCKED", // Customer
    SubscriptionStatus.GRACE_PERIOD,
    InvoiceStatus.ISSUED,
    PaymentStatus.PARTIALLY_REFUNDED,
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
    PaymentStatus.CHARGEBACK,
    "ERROR", // Settings Integrations/Webhooks
  ];
  const neutralInactive: string[] = [
    WorkspaceStatus.CANCELLED,
    ConversationStatus.CLOSED,
    ConversationStatus.ARCHIVED,
    LeadStatus.UNQUALIFIED,
    "CANCELLED", // Broadcast / Campaign
    "DISABLED", // Template
    InvoiceStatus.VOID,
    InvoiceStatus.REFUNDED,
    PaymentStatus.REFUNDED,
    "DISCONNECTED", // Settings Integrations/Webhooks
  ];

  if (positive.includes(status)) return "success";
  if (attention.includes(status)) return "warning";
  if (negative.includes(status)) return "danger";
  if (neutralInactive.includes(status)) return "neutral";
  return "info"; // NEW / OPEN / ASSIGNED / DRAFT and any unmapped value default to informational
}
