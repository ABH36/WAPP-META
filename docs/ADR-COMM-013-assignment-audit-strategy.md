# COMM-013 — Assignment Audit Strategy

**Status:** Accepted
**Type:** Documentation of an already-implemented model, plus a named gap for future work (no implementation required by this ADR)
**Date:** 2026-08-06
**Raised by:** Architecture Review (Phase-4 Part-4b recommendation #2)

## The actor model today: two kinds, not three

Every assignment path emits the same event, `DomainEvent.CONVERSATION_ASSIGNED` (`domain-events.ts`), with an `actorId: string` field. In practice `actorId` only ever holds one of two shapes:

1. **A real user id** (`user.userId`, the authenticated caller's own Identity `_id`) — every human-initiated assignment, regardless of that human's role.
2. **The literal string `"SYSTEM"`** — every platform-initiated assignment, with no human in the loop for that specific action.

**There is no third, distinct "ADMIN" actor value anywhere in the codebase.** When an Owner or Administrator manually assigns a Conversation, the event's `actorId` is still just their own `user.userId` — identical in shape to a Sales Manager or Support Manager doing the same thing. What makes it an admin-level action is which permission gated the endpoint that let them do it (`Permission.ASSIGN_CONVERSATIONS`, held by `OWNER/ADMINISTRATOR/SALES_MANAGER/SUPPORT_MANAGER` — see `permission-matrix.ts`), not a different shape of `actorId`. This ADR treats that as the correct, intentional model — **role/authorization is enforced at the permission-check layer, not encoded a second time into the audit actor field** — rather than introducing a redundant `ADMIN` actor kind that would need to stay in sync with the permission matrix by hand.

## Canonical actor per assignment source

| Source                                             | `actorId`                                                 | Where                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manual Assignment**                              | The assigning user's own `userId`                         | `ConversationController.assign()` → `ConversationService.assign()` — gated by `ASSIGN_CONVERSATIONS`                                                                                                                                                                                                                                                                                                                                          |
| **Automatic Assignment** (Part 4b)                 | `"SYSTEM"`                                                | `AutoAssignmentService` — no human caller exists for this path at all                                                                                                                                                                                                                                                                                                                                                                         |
| **Escalation Assignment** (Part 4c, not yet built) | `"SYSTEM"`                                                | Per the already-confirmed Part 4c scope ("real in-system action + event," same pattern as the auto-close sweep) — an escalation-driven reassignment has no human caller either, so it follows the same `"SYSTEM"` convention Auto Assignment and the Conversation auto-close sweep (`ConversationService.autoCloseInactive`) already established. **Not a new, third convention** — Part 4c should reuse this exact rule, not invent its own. |
| **Reassignment**                                   | Same as whichever of the three sources above performed it | Not a separate source — see below.                                                                                                                                                                                                                                                                                                                                                                                                            |

## Reassignment is not a separate source, and today's event can't tell it apart from a first assignment

`ConversationService.assign()` and `AutoAssignmentService`'s call into `ConversationRepository.assign()` are the same code path whether the Conversation was previously unassigned or already assigned to someone else — "reassignment" is just "assign, called again." (In practice, Auto Assignment itself never triggers this case — `AutoAssignmentService.maybeAssign()` no-ops the instant `assignedToUserId` is already set, per `docs/COMM-AUTO-ASSIGNMENT.md`; only Manual and, later, Escalation Assignment can actually reassign an already-assigned Conversation today.)

**A real, named gap:** `ConversationAssignedPayload` (`domain-events.ts`) carries `{workspaceId, conversationId, contactId, assignedToUserId, actorId, occurredAt}` — no `previousAssignedToUserId`. A listener consuming this event today cannot distinguish "this Conversation just got its first-ever assignee" from "this Conversation was reassigned away from someone else" without a separate query. This is acceptable for now because nothing consumes `CONVERSATION_ASSIGNED` yet (SDP-001 — Audit/Notification are later modules, same reasoning every other domain event in this catalog is emitted "for now, to a temporary logger"). It becomes a real limitation the moment a real Audit module needs to answer "who was this Conversation assigned to before?"

## Recommended payload extension for whenever Audit is built

Add `previousAssignedToUserId: string | null` to `ConversationAssignedPayload`, populated from the pre-update document (`ConversationRepository.assign()` would need to read-before-write, or use `findOneAndUpdate`'s ability to return the pre-image, instead of its current "just the post-image" call shape). Not implemented by this ADR — a small, contained change for whoever builds the real Audit module's Conversation-assignment history view, named here so it isn't rediscovered as a surprise gap at that point.

## What this ADR does not do

No code changes. `actorId`'s two-kind model (`USER id` / `"SYSTEM"`) is confirmed as correct and is not changing; `previousAssignedToUserId` is named as a recommended future addition, not built here.
