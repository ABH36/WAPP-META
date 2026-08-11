/**
 * FRD-001 Volume-4 — mirrors `apps/api/src/modules/communication`'s actual
 * runtime enums/types exactly, NOT `@wapp/shared-types`. Architecture
 * Review, 2026-08-11, found `@wapp/shared-types`'s `ConversationStatus`
 * has drifted from the real backend schema (`PENDING_CUSTOMER` vs. the
 * real `PENDING`), and the backend's `MessageStatus`/`MessageDirection`
 * have no `@wapp/shared-types` equivalent at all — the Communication
 * module defines all of these locally
 * (`apps/api/src/modules/communication/schemas/{conversation,message}.schema.ts`)
 * rather than importing the shared package. Fixing that drift is a
 * backend/shared-package concern outside this frontend volume's authority
 * (see docs/TECH-DEBT.md) — these types intentionally mirror the real,
 * running backend rather than the drifted shared package.
 */
export type ConversationStatus =
  "NEW" | "OPEN" | "ASSIGNED" | "PENDING" | "RESOLVED" | "CLOSED" | "SPAM" | "ARCHIVED";

export type MessageDirection = "INBOUND" | "OUTBOUND";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "DOCUMENT"
  | "AUDIO"
  | "VIDEO"
  | "STICKER"
  | "LOCATION"
  | "CONTACTS"
  | "INTERACTIVE"
  | "TEMPLATE"
  | "UNKNOWN";

/** `QUEUED` is defined but never actually returned — sends are synchronous, already `SENT` by the time a response arrives. `PROCESSED`/`VISIBLE` are reserved-but-unused for inbound (every inbound message goes straight to `RECEIVED` today). */
export type MessageStatus =
  "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED" | "PROCESSED" | "VISIBLE";

/** Mirrors `ConversationSummary` (`communication.types.ts`) — the same shape for both list items and `GET :id`. Note: `GET :id` does NOT populate `contactName`/`contactPhoneNumber` (the list endpoint does) — a real backend discrepancy, not a frontend bug; callers should prefer already-cached list data for contact display where possible. */
export interface ConversationSummary {
  id: string;
  contactId: string;
  contactPhoneNumber: string | null;
  contactName: string | null;
  phoneNumberId: string;
  status: ConversationStatus;
  assignedToUserId: string | null;
  lastMessageAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

/** Mirrors `MessageSummary`. */
export interface MessageSummary {
  id: string;
  conversationId: string;
  contactId: string;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  status: MessageStatus;
  occurredAt: string;
}

/** Mirrors `ConversationNoteSummary`. */
export interface ConversationNoteSummary {
  id: string;
  conversationId: string;
  authorUserId: string;
  text: string;
  createdAt: string;
}
