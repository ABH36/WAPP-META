import { ConversationStatus } from "./schemas/conversation.schema.js";
import { MessageDirection } from "./schemas/message.schema.js";

/**
 * Pure decision function for the automatic status nudges a new Message
 * (inbound or outbound) applies to its parent Conversation — see
 * docs/COMM-CONVERSATION-STATE-MACHINE.md. Kept standalone (not a method on
 * ConversationService) so ConversationRepository.recordActivity can call it
 * directly without introducing a Repository -> Service dependency, and so
 * it's unit-testable without a database.
 *
 * Returns the new status, or `null` if the message doesn't change status.
 */
export function nextStatusOnActivity(
  currentStatus: ConversationStatus,
  hasAssignee: boolean,
  direction: MessageDirection,
): ConversationStatus | null {
  const reopenTarget = hasAssignee ? ConversationStatus.ASSIGNED : ConversationStatus.OPEN;

  switch (currentStatus) {
    case ConversationStatus.CLOSED:
    case ConversationStatus.RESOLVED:
      // Either party resuming a finished conversation reopens it.
      return reopenTarget;
    case ConversationStatus.PENDING:
      // PENDING means "waiting on the customer" — any new activity (their
      // reply, or an agent following up) means we're no longer waiting.
      return reopenTarget;
    case ConversationStatus.NEW:
      // NEW means "nobody has engaged yet." An inbound message doesn't
      // change that (still nobody has engaged); an outbound message *is*
      // the first engagement.
      return direction === MessageDirection.OUTBOUND ? reopenTarget : null;
    case ConversationStatus.SPAM:
    case ConversationStatus.ARCHIVED:
      // Agent-decided terminal states — never auto-reopened by activity;
      // only a manual status change moves these.
      return null;
    case ConversationStatus.OPEN:
    case ConversationStatus.ASSIGNED:
      return null;
    default:
      return null;
  }
}

/** Statuses a manual PATCH .../status request may never target directly — system-managed only. */
export const SYSTEM_ONLY_STATUSES: ReadonlySet<ConversationStatus> = new Set([
  ConversationStatus.NEW,
]);
