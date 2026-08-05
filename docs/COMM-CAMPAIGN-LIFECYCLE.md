# Campaign Lifecycle

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 3b-ii (Campaign Management)
**Implemented in:** `apps/api/src/modules/communication/{schemas,repositories,services}/campaign*.ts`

## What a Campaign is — resolved 2026-08-05, Product Owner decision

The Business Decision Log describes Campaign as richer than Broadcast ("segmentation, scheduling, monitoring, analytics"), but segmentation runs into the exact same wall Broadcast's own audience model already named (`docs/COMM-BROADCAST-LIFECYCLE.md`): CRM doesn't exist until Phase 5, so there's no richer audience data to segment by. Resolved as: **a Campaign is a container orchestrating multiple Broadcasts ("waves") sent to one shared audience over a timeline** — not a segmentation upgrade. This differentiates genuinely from a single Broadcast (multi-step sequencing, rollup monitoring) without depending on anything that doesn't exist yet.

## A wave is a real Broadcast — nothing new sends anything

`Campaign.create()` creates the `Campaign` row once, then calls `BroadcastService.create()` once per wave — each wave is a completely ordinary `Broadcast` document, with a back-reference (`Broadcast.campaignId`). This means Campaign adds **zero new send-path code**: every wave gets Broadcast's full existing machinery unchanged — validation, `BroadcastRecipient` fan-out, `BroadcastExecutionProcessor`'s scheduled/sequential execution, the Meta Compliance Engine exemption (templates only, same as any Broadcast), pause/resume/cancel. Campaign is purely an orchestration and rollup layer on top.

**Shared vs. per-wave fields:** `phoneNumberId` and `targetContactIds` are set once on the Campaign and reused identically for every wave (the "from number" and "audience" don't change between waves). `templateId`, `bodyParameters`, and `scheduledAt` are per-wave (the message content and timing are exactly what varies — e.g. an announcement wave, then a reminder wave a few days later).

## Status model

```
ACTIVE ----(every wave reaches a terminal state)----> COMPLETED
  |
  +--cancel--> CANCELLED (cascades: cancel every still-active wave)
```

No `DRAFT` state — a Campaign is only ever created with at least one wave, and every wave requires a `scheduledAt` (unlike a standalone Broadcast, which can be created as `DRAFT` with no schedule). A Campaign therefore always has real scheduled work from the moment it exists, so it starts `ACTIVE` immediately — there's no separate "start the campaign" action.

## Completion detection — event-driven, not polled, and why

A Campaign completes once every one of its waves has reached a terminal state (`COMPLETED`/`CANCELLED`/`FAILED`). `CampaignService` never polls its waves to check this — instead, `BroadcastService` emits a new `BROADCAST_FINISHED` domain event on **every** terminal transition (deliberately distinct from the existing `BROADCAST_COMPLETED`, which only fires on successful completion — `BROADCAST_FINISHED` fires for `FAILED` and `CANCELLED` too, since Campaign needs to know a wave is _done_, not specifically that it succeeded). `CampaignService.onBroadcastFinished()` listens for it, and — only if `payload.campaignId` is set and the Campaign is still `ACTIVE` — checks `BroadcastRepository.countActiveByCampaign()`; zero remaining active waves means the Campaign transitions to `COMPLETED`.

**Why an event, not a direct method call:** `CampaignService` already depends on `BroadcastService` (to create and cancel waves). If `BroadcastService` also called back into `CampaignService` directly to report completion, that would be a circular dependency between the two services. Reusing the project's existing domain-event pattern (`docs/ADR-EVENTS-001`) breaks the cycle the same way it already decouples Communication from Audit/Notification — `BroadcastService` never needs to know Campaign exists; it just emits what happened.

## The cancel-cascade ordering matters

`CampaignService.cancel()` sets the Campaign to `CANCELLED` **before** cancelling any of its waves, not after. Each `BroadcastService.cancel()` call emits `BROADCAST_FINISHED` synchronously (EventEmitter2's default dispatch mode), which `CampaignService.onBroadcastFinished()` handles inline as part of that same call stack. If the Campaign were still `ACTIVE` at that point, cancelling the _last_ remaining wave would make the completion check see zero active waves and incorrectly mark the Campaign `COMPLETED` — overwriting an explicit user cancellation with the wrong terminal state. Setting `CANCELLED` first means the handler's own `campaign.status !== ACTIVE` guard short-circuits for every wave in the cascade, so the Campaign's status is exactly what the user asked for.

## Rollup stats — Layer 1 only, per ADR-COMM-007

`CampaignService.getStats()` sums each wave's `BroadcastRecipientRepository.getStats()` result (`pending`/`sent`/`failed`/`total`) across every wave, plus `waveCount`. This is Layer 1 (send-attempt progress) only, in the same terms `docs/ADR-COMM-007-broadcast-progress-strategy.md` already defines for a single Broadcast — Layer 2 (delivery/read progress, sourced from `Message.status`) is equally not implemented at the Campaign level as it isn't yet at the Broadcast level; the same future work closes both at once when it's built, by aggregating across every wave's `Message.broadcastId` set instead of one.

## What this document does not cover

- Delivery/read rollup (Layer 2) — see `docs/ADR-COMM-007-broadcast-progress-strategy.md`.
- Retry behavior for a failed wave — see `docs/ADR-COMM-006-broadcast-retry-strategy.md`; nothing here changes per-wave retry handling.
- Cross-wave analytics beyond the simple send-attempt sum (e.g. "did the Reminder wave perform better among people who didn't open the Announcement wave") — real analytics work, out of scope for this orchestration layer.
