# Conversation State Machine

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 2 (Shared Team Inbox & Conversation Management)
**Implemented in:** `apps/api/src/modules/communication/schemas/conversation.schema.ts`, `conversation-state-machine.ts`

## Status list

The 8 statuses are BRD-001's approved Conversation Status list (New, Open, Assigned, Pending, Resolved, Closed, Spam, Archived), with BDC-012's confirmed relationship: **Resolved -> Closed is a sequential, auto-close-after-inactivity transition, not two independent terminal states.**

| Status     | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `NEW`      | Created by the first inbound message; nobody has engaged yet. |
| `OPEN`     | Actively being handled, no specific assignee.                 |
| `ASSIGNED` | Actively being handled, assigned to a specific agent.         |
| `PENDING`  | Waiting on the customer (agent is waiting for their reply).   |
| `RESOLVED` | Agent considers the conversation done.                        |
| `CLOSED`   | Finalized — either manually, or by the auto-close sweep.      |
| `SPAM`     | Manually marked spam by an agent. Never auto-reopened.        |
| `ARCHIVED` | Manually archived. Never auto-reopened.                       |

**Confidence note:** unlike the Message state machine (`docs/COMM-MESSAGE-STATE-MACHINE.md`), no PRD document with verbatim transition rules for these 8 statuses was available when this was built — only the status _names_ were confirmed (BRD-001) plus the Resolved->Closed relationship (BDC-012). The transition rules below are this implementation's own reasonable, defensible construction, not a verified restatement of a business requirement. Revisit if a more detailed source document surfaces.

## Automatic transitions (new Message activity)

Every new Message (inbound or outbound) can nudge its Conversation's status — see `conversation-state-machine.ts`'s `nextStatusOnActivity()`, a pure function shared by both `WebhookService` (inbound) and `MessageService.sendText()` (outbound), called via `ConversationRepository.recordActivity()`.

- **CLOSED or RESOLVED + any new message** -> reopens to `ASSIGNED` (if an assignee is already set) or `OPEN` (if not). Either party resuming a finished conversation reopens it — history stays on the same Conversation record, no new one is created (one Conversation per `(workspaceId, contactId)`, same dedup pattern as Contact/ADR-COMM-002).
- **PENDING + any new message** -> same reopen rule. PENDING means "waiting on the customer"; any activity (their reply, or an agent following up) means we're no longer waiting.
- **NEW + inbound message** -> no change (nobody has engaged yet; another message from the customer doesn't change that).
- **NEW + outbound message** -> reopen rule applies (an agent's first reply _is_ the first engagement).
- **OPEN or ASSIGNED + any new message** -> no change.
- **SPAM or ARCHIVED + any new message** -> no change. These are agent-decided terminal states; only a manual status change moves them, activity never auto-reopens them.

## Manual transitions (PATCH .../status)

Any status except `NEW` may be set manually (`NEW` is system-managed only — enforced by `SYSTEM_ONLY_STATUSES` in `conversation-state-machine.ts`, returns `400`). Setting `RESOLVED` stamps `resolvedAt`; setting `CLOSED` stamps `closedAt` (an agent can close immediately without waiting for the auto-close sweep). Moving away from either clears the respective timestamp. No other manual-transition matrix is enforced — an agent can move between any two non-`NEW` statuses (e.g., reopen `CLOSED` -> `OPEN` by hand, mark `SPAM` from any state) as no source document specifies a stricter allowed-transitions table.

## Assignment's own status effect

Assignment (`PATCH .../assign`) is a separate axis from the automatic-activity nudges above, handled by `ConversationService.assign()`:

- Assigning a `NEW` or `OPEN` conversation promotes it to `ASSIGNED` (assigning implies triage happened).
- Unassigning an `ASSIGNED` conversation demotes it to `OPEN` ("Assigned" with no assignee is a contradiction).
- Any other current status (`PENDING`/`RESOLVED`/`CLOSED`/`SPAM`/`ARCHIVED`) is left alone on reassignment — it doesn't imply a lifecycle change on its own.

## Auto-close sweep

`ConversationAutoCloseProcessor` runs every `CONVERSATION_AUTO_CLOSE_SWEEP_INTERVAL_MS` (1 hour) and closes every `RESOLVED` conversation whose `resolvedAt` is older than `CONVERSATION_AUTO_CLOSE_HOURS` (fixed at 24). This threshold is a **platform-wide constant, not yet per-workspace configurable** — the original module scope said "configurable duration"; this is a known, deliberate Part-2 simplification, tracked as TD-003 in `docs/TECH-DEBT.md`, not an oversight.

## What this document does not cover

- Message-level status (`QUEUED`/`SENT`/`DELIVERED`/... ) — see `docs/COMM-MESSAGE-STATE-MACHINE.md`. A Message's status and its parent Conversation's status are independent axes, as that document already states.
- The 24-hour Meta customer-service-window compliance check (whether a reply is even allowed to be free-text right now) — that's the Compliance Engine, PRD-003 Part 3 scope per BDC-008. Part 2's reply path relies on Meta's own API-side rejection (surfaced as `MetaValidationException`, per `docs/COMM-META-ERROR-HANDLING-STRATEGY.md`) as an interim safety net.
- Inbox visibility rules — resolved separately (Product Owner decision, 2026-08-05): open to all workspace roles with `REPLY_CONVERSATIONS` access; no team/label-based segmentation in Part 2.
