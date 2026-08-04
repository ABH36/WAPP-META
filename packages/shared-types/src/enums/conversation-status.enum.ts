/**
 * Traces to: PRD-003 Part 2 §G (Conversation Status), clarified by PRD-000C BDC-012.
 *
 * Lifecycle (BDC-012): OPEN -> RESOLVED -> CLOSED.
 * - RESOLVED: conversation completed by an agent.
 * - CLOSED: archived by system (Auto-Close, after configured inactivity on a
 *   RESOLVED conversation — PRD-003 Part 4 §F/§K) or manually by a user.
 * A customer reply on a CLOSED conversation automatically reopens it (PRD-003 Part 4 §K).
 */
export enum ConversationStatus {
  NEW = "NEW",
  OPEN = "OPEN",
  ASSIGNED = "ASSIGNED",
  PENDING_CUSTOMER = "PENDING_CUSTOMER",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  SPAM = "SPAM",
  ARCHIVED = "ARCHIVED",
}
