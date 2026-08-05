# Automation Engine — Auto Assignment

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 4b (Automation Engine — Auto Assignment, per ADR-014)
**Implemented in:** `apps/api/src/modules/communication/services/auto-assignment.service.ts`

## What this slice owns

Part 4b routes a brand-new, still-unassigned Conversation to an eligible agent automatically, using one of two strategies a workspace opts into: **Round Robin** (cycle through agents in order) or **Least Active Agent** (assign to whoever currently has the fewest open Conversations). Off by default (`AssignmentStrategy.NONE`) — the pre-Part-4b behavior (manual assignment only, via the existing `PATCH /conversations/:id/assign`) is unchanged unless a workspace explicitly configures a strategy.

## Reuses AutomationSettings — no new collection

`AssignmentStrategy` and `roundRobinLastAssignedUserId` were added to the existing `AutomationSettings` document (Part 4a) rather than creating a new one — same one-document-per-workspace automation config surface, extended, not duplicated. `roundRobinLastAssignedUserId` is Round Robin's own rotation pointer (the last agent an auto-assignment picked); it is never user-settable — `UpdateAutomationSettingsDto` deliberately excludes it, only `AutoAssignmentService` itself ever writes it.

## Only touches unassigned Conversations, on inbound message — resolved 2026-08-05, Product Owner decision

`AutoAssignmentService.maybeAssign()` is a no-op the instant `Conversation.assignedToUserId` is already set — it never reassigns or overrides an existing assignment, matching how manual assignment already behaves as a one-time action rather than something that gets silently undone. It runs once per inbound message, in `WebhookService.handleInboundMessage()`, immediately after Welcome/Away evaluation (`AutomationService.maybeSendAutoReply()`) — the canonical inbound-message automation order fixed by `docs/ADR-COMM-011-automation-priority-strategy.md`.

## Eligibility — resolved 2026-08-05, Product Owner decision

The eligible pool is workspace members with `workspaceMemberStatus: ACTIVE` holding `SALES_EXECUTIVE` or `SUPPORT_EXECUTIVE` (`AUTO_ASSIGNMENT_ELIGIBLE_ROLES`, `communication.constants.ts`) — the front-line, conversation-handling roles, not the broader `REPLY_CONVERSATIONS` set (which also includes `OWNER`/`ADMINISTRATOR`/`SALES_MANAGER`/`SUPPORT_MANAGER`, deliberately excluded from the auto-assignment pool). There is no online/available/presence concept anywhere in this codebase today — "eligible" means "an active member in one of these two roles," not "currently online." See TD-004 in `docs/TECH-DEBT.md` for the tradeoff this accepts.

## Strategies

**Round Robin.** Finds the eligible agent after whoever `roundRobinLastAssignedUserId` names, in a stable order (`UserRepository.findByWorkspaceRolesActive` sorts by `createdAt` ascending), wrapping back to the first agent after the last. Starts at the first eligible agent if there's no prior pick, or if the last-picked agent is no longer eligible (removed, suspended, role-changed) — never errors on a stale pointer.

**Least Active Agent.** Counts each eligible agent's current non-terminal-status assigned Conversations (`ConversationRepository.countActiveAssignedToUser` — everything except `RESOLVED`/`CLOSED`/`SPAM`/`ARCHIVED`) and picks the minimum, ties broken by the same stable `createdAt` order Round Robin uses (deterministic, not random).

## Reuses ConversationRepository.assign() directly, not ConversationService

`AutoAssignmentService` calls `ConversationRepository.assign()` (and emits `DomainEvent.CONVERSATION_ASSIGNED` itself, `actorId: "SYSTEM"`) rather than going through `ConversationService.assign()`. This mirrors the exact reasoning `ConversationRepository.recordActivity()`'s own doc comment already gives for why `MessageService`/`WebhookService` talk to the Repository layer directly: keeping `WebhookService`'s dependency chain from reaching into `ConversationService` at all, the same way it already avoids `ConversationService` for the automatic status-nudge on every inbound message. The transition rule (unassigned `NEW`/`OPEN` → `ASSIGNED`, anything else left alone) is intentionally the same rule `ConversationService.assign()` applies for a manual assignment — duplicated in a few lines rather than shared through a new dependency edge.

## Never blocks, never fails the webhook — same contract as Part 4a

`maybeAssign()` wraps its own logic in try/catch and never throws, per `docs/ADR-COMM-010-automation-execution-policy.md` — a failed auto-assignment (e.g. a transient Mongo error) logs and moves on; it never fails the inbound webhook request that triggered it, and never leaves the Conversation, Contact, or Message writes that already committed in a partial state.

## What this document does not cover

- SLA Monitoring + Escalation Rules (Part 4c) — not started.
- Real agent presence/online tracking — see TD-004, `docs/TECH-DEBT.md`.
- Manual reassignment or bulk reassignment tooling — out of scope; `PATCH /conversations/:id/assign` (Part 2) is unchanged and remains the only way to move an already-assigned Conversation to someone else.
