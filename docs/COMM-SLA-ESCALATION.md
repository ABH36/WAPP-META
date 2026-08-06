# Automation Engine — SLA Monitoring & Escalation Rules

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-003 Part 4c (Automation Engine — SLA Monitoring & Escalation Rules)
**Implemented in:** `apps/api/src/modules/communication/services/escalation.service.ts`, `queue/sla-escalation.processor.ts`

## What this slice owns

Part 4c detects Conversations whose customer has been waiting too long for a reply and escalates them — reassigns to a Manager and emits a domain event — on a fixed timer, independent of any single inbound message. No new Conversation status is introduced; escalation is a reassignment plus a timestamp, not a lifecycle change.

## SLA metric — response-time, not resolution-time — resolved 2026-08-06, Product Owner decision

A Conversation is SLA-breached when the customer's last message is still the most recent message overall (nobody — agent or system — has replied since) and that wait has lasted past `SLA_RESPONSE_HOURS`. This is deliberately **not** a resolution-time SLA (total time until `RESOLVED`) — it measures responsiveness specifically, the standard definition for a support/sales inbox SLA.

`PENDING` Conversations are excluded from breach detection: per `conversation-state-machine.ts`, `PENDING` means "waiting on the customer," not waiting on the business — escalating a Conversation where the business is deliberately waiting for the customer to reply would be backwards.

## Two steps of one sweep, per ADR-COMM-011

`EscalationService.runSweep(cutoff)` does SLA Monitoring (detection) and Escalation Rules (action) as two steps of the same call — Escalation never runs independently of a preceding Monitoring pass, matching `docs/ADR-COMM-011-automation-priority-strategy.md`'s periodic-sweep-context design. `SlaEscalationProcessor` triggers it on a timer, in the exact shape `ConversationAutoCloseProcessor` (BDC-012's auto-close sweep) already established — a BullMQ repeatable job registered on `onModuleInit`, not a request-path call.

## Breach detection query

`ConversationRepository.findSlaBreachCandidates(cutoff)`: `status` excludes every terminal status plus `PENDING`; `lastCustomerMessageAt <= cutoff`; `lastMessageAt == lastCustomerMessageAt` (via Mongo's `$expr`, comparing the two fields directly rather than needing a separate "awaiting reply" boolean the write path would have to keep in sync). The same `cutoff` also gates re-escalation — `lastEscalatedAt` must be null or itself before `cutoff` — so a Conversation escalated once isn't escalated again on every subsequent sweep pass; it needs another full `SLA_RESPONSE_HOURS` window to still be unanswered.

## Escalation action: reassign to the least active eligible Manager — resolved 2026-08-06, Product Owner decision

`EscalationService` finds eligible Managers (`SLA_ESCALATION_MANAGER_ROLES` = `SALES_MANAGER`/`SUPPORT_MANAGER`, active members) for the breached Conversation's workspace, and picks whoever currently has the fewest active Conversations — the exact same Least Active Agent logic Part 4b's `AutoAssignmentService` already built, applied to the Manager pool instead of the front-line agent pool. Reassignment reuses `ConversationRepository.assign()` directly and emits the existing `CONVERSATION_ASSIGNED` event (`actorId: "SYSTEM"`) — the same reuse pattern `docs/COMM-AUTO-ASSIGNMENT.md` already established, now applied a second time. The status-transition rule is identical too: an unassigned `NEW`/`OPEN` Conversation is promoted to `ASSIGNED`; any other status is left alone.

**Scope, confirmed:** SLA Monitoring/Escalation applies to every non-terminal, non-`PENDING` Conversation awaiting reply — assigned or not. An unassigned Conversation that nobody has ever engaged with is, if anything, the more urgent case to escalate, not a lesser one; it isn't left to Auto Assignment alone (which may be off, or may have found no eligible front-line agent).

## No eligible Manager — still reports the breach

If a workspace has no active `SALES_MANAGER`/`SUPPORT_MANAGER`, `EscalationService` does not reassign (nothing to reuse `ConversationRepository.assign()` for) but still updates `lastEscalatedAt` and still emits `CONVERSATION_SLA_BREACHED` with `escalatedToUserId: null`. Detection succeeded even though the action had nobody to act on — silently dropping the breach entirely would hide a real problem (an SLA is being missed and there's no one to escalate to) from the future Notification module that will eventually consume this event.

## A second event, not just `CONVERSATION_ASSIGNED` — closes part of the ADR-COMM-013 gap

`CONVERSATION_ASSIGNED` alone can't say _why_ an assignment happened (ADR-COMM-013's named payload gap). `DomainEvent.CONVERSATION_SLA_BREACHED` is Escalation's own event, carrying `escalatedToUserId`, `previousAssignedToUserId` (captured from the in-memory candidate document before the reassignment overwrites it — no extra read needed), and `breachedSinceHours`. It fires once per escalated Conversation, in addition to `CONVERSATION_ASSIGNED` when a reassignment actually happened, and alone when it didn't (no eligible Manager).

## Per-candidate failure isolation

`EscalationService.runSweep()` wraps each candidate's escalation in its own try/catch — one Conversation failing (a transient Mongo error, for instance) logs and moves on rather than aborting the whole sweep and leaving every other breached Conversation unescalated until the next hourly pass.

## What this document does not cover

- Business-hours-aware SLA timing (today's `SLA_RESPONSE_HOURS` is flat wall-clock time, not business-hours-adjusted) — see TD-005, `docs/TECH-DEBT.md`.
- Per-workspace-configurable SLA threshold — same TD-005.
- Notification delivery for `CONVERSATION_SLA_BREACHED` — no Notification module exists yet (SDP-001 module order); this event is emitted for that future consumer, same as every other domain event in the catalog today.
