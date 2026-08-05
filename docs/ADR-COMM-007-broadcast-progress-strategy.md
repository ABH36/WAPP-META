# COMM-007 — Broadcast Progress Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-3b-i recommendation #2)

## Current state

`BroadcastRecipientRepository.getStats()` returns exactly four numbers, aggregated from `BroadcastRecipient.status`: `pending`, `sent`, `failed`, `total`. That's **send-attempt** progress only — it answers "how much of the recipient list have we tried," not "how many of those messages actually reached or were read by the customer." `docs/COMM-BROADCAST-LIFECYCLE.md` already names this boundary ("`BroadcastRecipient` only tracks send-attempt outcome... a future 'delivery rate' report reads `Message.status`") but never defined the actual calculation. This ADR is that definition.

## Decision — two layers of progress, from two different collections, never merged into one ambiguous number

**Layer 1 — Send progress** (already implemented, `BroadcastRecipientRepository.getStats()`), sourced entirely from `BroadcastRecipient.status`:

| Field                  | Definition                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `totalRecipients`      | Count of `BroadcastRecipient` rows for the Broadcast — fixed at creation (the deduplicated target Contact list size), never changes afterward.                                                                                                                                                                                                                                             |
| `pending`              | `status === PENDING` — not yet attempted.                                                                                                                                                                                                                                                                                                                                                  |
| `sent`                 | `status === SENT` — successfully handed to Meta (an accepted send, **not** a confirmed delivery).                                                                                                                                                                                                                                                                                          |
| `failed`               | `status === FAILED` — the send attempt itself failed (never reached Meta successfully, or was rejected outright).                                                                                                                                                                                                                                                                          |
| `completionPercentage` | `(sent + failed) / totalRecipients * 100` — the fraction of the recipient list that has reached a **terminal send-attempt state**. This is what `BroadcastStatus` transitions to `COMPLETED` on (zero `PENDING` left) — completion is about the send _job_ finishing, not about delivery success. A Broadcast can be 100% complete with a 60% failure rate; those are different questions. |

**Layer 2 — Delivery progress** (not yet implemented — the actual gap this ADR closes), sourced from `Message.status` for every `Message` where `broadcastId` matches this Broadcast (a query Part-3b-i's own schema already supports, per `docs/COMM-BROADCAST-LIFECYCLE.md`'s `Message.broadcastId` link):

| Field            | Definition                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delivered`      | Count of matching Messages where `status` is `DELIVERED` **or** `READ`. Both count as "delivered or better" — per `docs/COMM-MESSAGE-STATE-MACHINE.md`, Meta doesn't guarantee every intermediate status fires, so a message can jump straight from `SENT` to `READ` without an observed `DELIVERED` event; a strict `status === DELIVERED` count would under-report.                                                                  |
| `read`           | Count of matching Messages where `status === READ` specifically (a strict subset of `delivered`).                                                                                                                                                                                                                                                                                                                                      |
| `deliveryFailed` | Count of matching Messages where `status === FAILED` — a _different_ failure than `BroadcastRecipient.status === FAILED`: this means Meta accepted the send (so the recipient row is `SENT`) but later reported delivery failure via the status webhook. Reported separately from Layer 1's `failed` so the two failure reasons ("we couldn't send it" vs. "Meta couldn't deliver it") are never conflated into one misleading number. |

## Why two layers instead of one combined "progress" object

Merging both into a single response invites exactly the ambiguity this ADR is meant to close — e.g., a naive `deliveryPercentage = delivered / total` would silently misrepresent a Broadcast that's still only 20% _sent_ (80% still `PENDING`) as having a low delivery rate, when the real story is "hasn't gotten there yet," not "recipients aren't opening it." Layer 1 answers "is the send job done," Layer 2 answers "how did the messages that were sent actually perform" — genuinely different questions with genuinely different denominators (`totalRecipients` vs. `sent`).

## What this ADR does not do

`GET .../broadcasts/:id/stats` still returns only Layer 1 today — no code changes ship with this document, per the Architect's framing. It defines the calculation whoever extends that endpoint (or builds a dedicated delivery-report view) should implement, so Layer 2 is added once, correctly, rather than approximated ad hoc.
