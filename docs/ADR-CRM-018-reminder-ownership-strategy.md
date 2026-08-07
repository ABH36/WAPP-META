# Reminder Ownership Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-5 §9/BR-007 — the boundary between CRM reminder storage and Notification-module execution, factored out of `docs/ADR-CRM-015-activity-timeline-strategy.md` into its own document per Architecture Review recommendation
**Implemented in:** `apps/api/src/modules/crm/schemas/activity.schema.ts`

## CRM owns scheduling; Notification owns delivery

A Reminder is an `Activity` document (`type: REMINDER`) carrying exactly two Reminder-specific fields: `reminderDate` (when it's due) and `reminderType` (`NOTIFICATION` or `EMAIL` — how it should eventually be delivered). Volume-5 §9 states reminder _execution_ "is handled by the Notification module," and BR-007 states scheduling must "never bypass Notification ownership." Both are read literally: CRM's job stops at storing and validating _when_ and _how_ a reminder should fire; CRM never sends anything itself.

## Why nothing detects a due Reminder yet

No Notification module exists anywhere in this codebase (confirmed against D010's approved 18-module list, where Notifications is its own, later, not-yet-built module). §16 lists "Reminder Triggered" as a domain event — implying _something_ eventually watches for due reminders and fires it — but building that watcher now, with nothing subscribed to what it would emit, was resolved against during Architecture Review. Two reasons converged on this:

1. **Nothing to fire into.** This codebase's established "publish now, no listener yet" pattern (`domain-events.ts`'s own header comment) works because the _event_ has a stable, agreed name and payload shape even before a listener exists — but a `REMINDER_TRIGGERED` event's payload shape and firing semantics are properly the Notification module's own design decision (does it need workspace-level notification preferences? batching? retry semantics on delivery failure?). Guessing that shape now, ahead of Notification's own PRD, risks getting it wrong and needing a breaking change later — worse than not declaring it yet.
2. **No emitter would exist regardless.** A sweep (the mechanism that would need to run periodically, find due reminders, and call `eventEmitter.emit(...)`) is real, non-trivial scope on its own — comparable to Communication's SLA-breach sweep (`docs/COMM-SLA-ESCALATION.md`), which was its own dedicated sub-part (Part 4c) rather than a byproduct of a different feature. Building it here, inside a Part whose actual approved scope is Activities/Tasks/Follow-ups/Notes, would be scope creep against Volume-5's own boundaries.

## What this means concretely

- `Activity.reminderDate`/`Activity.reminderType` are stored and validated (required together when `type=REMINDER`) — full CRUD via the generic `/crm/activities/*` routes, same as every other Activity type.
- No scheduled job, cron, or sweep exists for Reminders anywhere in this codebase.
- No `REMINDER_TRIGGERED` constant exists in `domain-events.ts` — declaring it with zero emitters would be dead code, and it's added exactly when a future Part builds both the sweep and the Notification listener that gives the event a reason to exist.
- A Reminder that becomes due today produces no visible effect beyond continuing to exist as a normal, queryable Activity — this is the intended, complete Phase-5 Part-5 behavior, not a partial implementation of something larger.

## Trigger to revisit

When the Notification module (D010's module #14) is designed and built, that work is the natural place to add both the sweep (likely living in CRM, since it needs to query `activities`) and the `REMINDER_TRIGGERED` event/payload shape, informed by whatever delivery-preference model Notification actually defines rather than one guessed at here.
