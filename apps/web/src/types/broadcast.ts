/** FRD-001 Volume-4 — mirrors `apps/api`'s real local `BroadcastStatus`/`BroadcastRecipientStatus` enums (`broadcast.schema.ts`/`broadcast-recipient.schema.ts`), not `@wapp/shared-types` (kept consistent with `types/conversation.ts`'s "mirror the running backend" rule, even though `BroadcastStatus`'s values happen to already match the shared package today). */
export type BroadcastStatus =
  "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";

export type BroadcastRecipientStatus = "PENDING" | "SENT" | "FAILED";

/** Mirrors `BroadcastSummary`. */
export interface BroadcastSummary {
  id: string;
  name: string;
  templateId: string;
  phoneNumberId: string;
  campaignId: string | null;
  bodyParameters: string[];
  status: BroadcastStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

/** Mirrors `BroadcastRecipientSummary`. Send-attempt outcome only ("Layer 1") — delivered/read breakdowns don't exist yet (ADR-COMM-007, documented-but-unbuilt). */
export interface BroadcastRecipientSummary {
  id: string;
  contactId: string;
  status: BroadcastRecipientStatus;
  messageId: string | null;
  errorDetail: string | null;
  sentAt: string | null;
}

/** Mirrors `BroadcastRecipientStats` (`GET .../broadcasts/:id/stats`). Labelled "Send Progress" in the UI, never "Delivery Summary" — `sent` means "accepted by Meta," not delivered/read. */
export interface BroadcastRecipientStats {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}
