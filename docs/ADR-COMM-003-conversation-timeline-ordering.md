# COMM-003 — Conversation Timeline Ordering

**Status:** Accepted
**Type:** Frontend-facing contract (documentation only — no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-2 recommendation #1)

## Context

A Conversation's timeline is made up of six conceptually different item types: Inbound Messages, Outbound Messages, Internal Notes, Assignment Events, Status Changes, and System Events. Today these live in different places (`Message` and `ConversationNote` are persisted collections; assignment/status changes are only ever emitted as domain events — see `docs/ADR-EVENTS-001`). Before a frontend timeline component gets built, there needs to be one canonical rule for interleaving all six into a single chronological view, so every future consumer (web app, admin, any future export) orders them identically.

## Decision

**One ordering key, shared by every item type: the UTC instant the event actually happened, not when it was recorded.**

| Item type           | Ordering timestamp source                                               |
| ------------------- | ----------------------------------------------------------------------- |
| Inbound Message     | `Message.occurredAt` (Meta's own event timestamp, not our receipt time) |
| Outbound Message    | `Message.occurredAt` (set at send time)                                 |
| Internal Note       | `ConversationNote.createdAt`                                            |
| Assignment Event    | the `occurredAt` already carried on `ConversationAssignedPayload`       |
| Status Change Event | the `occurredAt` already carried on `ConversationStatusChangedPayload`  |
| System Event        | its own `occurredAt` (e.g. the auto-close sweep's transition timestamp) |

Sort ascending by this single field. **Tie-break:** insertion order, using each item's Mongo `_id` as a stable secondary sort key (ObjectIds are monotonically increasing at millisecond granularity, so two items with an identical `occurredAt` value still sort deterministically and consistently across repeated queries).

Every timeline item the frontend receives is tagged with a discriminated `type` field — one of `MESSAGE_INBOUND`, `MESSAGE_OUTBOUND`, `NOTE`, `ASSIGNMENT_CHANGED`, `STATUS_CHANGED`, `SYSTEM` — so rendering logic switches on an explicit tag instead of inferring type from shape.

## Why event time, not record time

Webhook redelivery, retry, and processing lag all mean "when we wrote the row" can lag "when it actually happened" by seconds to minutes. A timeline ordered by insertion time would occasionally show an inbound message appearing to arrive _after_ the agent's reply to it, purely because of processing-queue timing (see `WebhookProcessingProcessor` — inbound messages are processed asynchronously via BullMQ). Event time is the only ordering that matches what actually happened in the conversation.

## Known gap this ADR does not close

Assignment Events, Status Change Events, and System Events currently have **no persisted, queryable record** — they exist only as ephemeral domain events (logged by `DomainEventLoggerListener`, not stored). This ADR defines the ordering _contract_ those event types must follow once something persists them (a future Conversation Timeline Event collection, or querying the eventual Global Audit Center per PRD-007's "aggregates all auditable events platform-wide"). It does not itself add that persistence — per the Architect's own framing, this recommendation is documentation only and does not require implementation at this stage. A future ADR (or a Part 2 addendum) should decide _where_ these events end up stored/queryable; this one only decides how they'd be ordered once they are.

## Consequences

- The frontend timeline component can be built against a stable contract today for Messages and Notes (both already queryable via `GET /communication/conversations/:id/messages` and `GET /communication/conversations/:id/notes`), and extended later for the other three types without an ordering redesign.
- Any future "merged timeline" endpoint (a single `GET .../timeline` combining all six types server-side) should apply exactly this sort rule rather than inventing a new one.
