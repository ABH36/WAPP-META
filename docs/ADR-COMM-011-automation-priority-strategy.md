# COMM-011 — Automation Priority Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-4a recommendation #2)

## Purpose

Part 4a introduced the first two automation features (Business Hours Evaluation, Welcome/Away Messages). Part 4b (Auto Assignment) and Part 4c (SLA Monitoring, Escalation Rules) add more, each triggered by different events on the same underlying Conversation/Message data. Without a decided execution order, it's ambiguous whether, say, a newly-arrived message should be auto-assigned before or after Welcome fires, or whether an Escalation Rule could fire mid-way through an Auto Assignment decision. This ADR fixes that order now, before Part 4b is built, so each feature lands already knowing where it sits.

## Two execution contexts, not one pipeline

Automation in this codebase runs in two structurally different places, and mixing them into one ordered list would be misleading:

1. **Inbound-message-triggered** — runs synchronously inside `WebhookService.processEvent()`, after the inbound `Message` is persisted (per ADR-COMM-010), on the webhook-processing queue. Today: Business Hours Evaluation, Welcome/Away.
2. **Periodic-sweep-triggered** — runs on a fixed timer via its own BullMQ repeatable job, independent of any single inbound message, following the exact shape already established by `ConversationAutoCloseProcessor` (BDC-012's auto-close sweep). SLA Monitoring and Escalation Rules belong here: an SLA breach isn't discovered by a new message arriving, it's discovered by time passing with no reply.

## Canonical order — inbound-message-triggered context

1. **Business Hours Evaluation.** Not an action, a shared precondition — computed once (`isWithinBusinessHours()`) and reused by whichever later step needs it, rather than each feature re-evaluating it independently. Must run first because Welcome/Away's branch decision depends on its result.
2. **Welcome/Away Messages.** Customer-facing; runs first among the "real" automation steps so the customer sees a response with the least possible delay. Does not depend on anything after it in this order.
3. **Auto Assignment (Part 4b).** Internal routing — decides which agent/queue owns the conversation. Runs after Welcome/Away deliberately: assigning an agent is not a precondition for greeting the customer, and Welcome/Away's own cooldown/eligibility logic has no dependency on who (if anyone) the conversation ends up assigned to. A future per-message automation step not yet named is appended after Auto Assignment, not inserted earlier, unless a specific new dependency forces re-ordering (in which case that dependency, not convenience, should be the documented reason).

Each step in this list publishes its own domain event as its own last action — see "Where Domain Event Publication fits" below — not deferred to a single event-emission phase after every step has run.

## Canonical order — periodic-sweep-triggered context

1. **SLA Monitoring.** Reads the current state (time since last customer/agent activity, per-conversation SLA clock) and identifies breaches. Purely a read/detection step — it does not itself take any corrective action.
2. **Escalation Rules.** Consumes SLA Monitoring's breach detection and acts on it (reassign, flag, notify — per the already-approved "real in-system action + event" decision for Part 4c). Escalation never runs without a preceding SLA Monitoring pass in the same sweep; it has no independent trigger of its own.

## Where Domain Event Publication fits

Not a final phase bolted onto the end of either list — each automation step publishes its own event as the last thing it does, after its own state change has committed, mirroring the pattern already established by `BroadcastService` (`BROADCAST_FINISHED` emitted after the status transition, not before) and `WebhookService` (`MESSAGE_RECEIVED` emitted after `Message.create()`, not before). Concretely: Auto Assignment commits the assignment, then emits its event; Escalation Rules take their action, then emit theirs. This keeps "did the action happen" and "was the event for it published" from ever being ambiguous relative to each other, and avoids one step's event handler observing a later step's not-yet-applied state.

## What this ADR does not do

No code changes — Auto Assignment, SLA Monitoring, and Escalation Rules are not implemented by this document. It exists so Part 4b and Part 4c are built directly into the order and event-publication convention decided here, rather than each deciding its own placement independently and risking a later reconciliation.
