# WhatsApp Message State Machine

**Status:** Accepted — canonical lifecycle for Communication, Shared Inbox (Part 2), and Analytics (Part 5)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-1 recommendation #1)
**Implemented in:** `apps/api/src/modules/communication/schemas/message.schema.ts` (`MessageStatus`)

## Why one state machine, two directions

A `Message` is either outbound (WAPP → customer) or inbound (customer → WAPP) — `direction` is fixed at creation and never changes. The two directions have genuinely different lifecycles (an inbound message is never "delivered" in Meta's sense; an outbound message is never "received"), so `MessageStatus` is really two separate state machines sharing one enum and one field, distinguished by `direction`. A given Message only ever transitions through the states valid for its own direction.

## Outbound lifecycle

```
QUEUED -> SENT -> DELIVERED -> READ
   |         |
   +-------> FAILED (from QUEUED or SENT)
```

| State       | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                             | Set by |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `QUEUED`    | Accepted by WAPP, not yet confirmed sent by Meta. **Not currently used** — Part-1's `MessageService.sendText()` calls the Graph API synchronously and only persists the Message once Meta has already returned a message id, so a Part-1-created outbound Message starts at `SENT`, never `QUEUED`. Reserved for when outbound sending itself becomes queue-based (see the Meta Error Handling Strategy doc's retry-behavior note). |
| `SENT`      | Meta accepted the message and returned a `wamid`. Set immediately by `MessageService.sendText()`.                                                                                                                                                                                                                                                                                                                                   |
| `DELIVERED` | Meta's `statuses` webhook reported delivery to the recipient's device. Set by `WebhookService.handleStatusUpdate()`.                                                                                                                                                                                                                                                                                                                |
| `READ`      | Meta's `statuses` webhook reported the recipient opened the message (only if their WhatsApp read-receipt setting allows it). Set by `WebhookService.handleStatusUpdate()`.                                                                                                                                                                                                                                                          |
| `FAILED`    | Meta's `statuses` webhook reported delivery failure, or (not yet implemented) the initial send call itself failed after retries. `errorDetail` carries Meta's error message. Set by `WebhookService.handleStatusUpdate()`.                                                                                                                                                                                                          |

Meta does not guarantee every intermediate status is delivered (a message can jump straight from `SENT` to `READ`) — the state machine tolerates skipped transitions; it does not validate that a status update follows a specific predecessor state.

## Inbound lifecycle

```
RECEIVED -> PROCESSED -> VISIBLE
```

| State       | Meaning                                                                                                                                                                                                                                                                    | Set by |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `RECEIVED`  | Webhook signature verified, message persisted with a Contact resolved. The only inbound state Part-1 actually reaches. Set by `WebhookService.handleInboundMessage()`.                                                                                                     |
| `PROCESSED` | **Reserved, not yet implemented.** Intended for once business-rule processing has run against the message (dedup already happens before `RECEIVED` is even set; this is for future automation — Part 4's Rule-Based Automation — auto-assignment, keyword triggers, etc.). |
| `VISIBLE`   | **Reserved, not yet implemented.** Intended for once the message is surfaced in a human-facing Shared Inbox conversation (Part 2) — the point at which "received" becomes "an agent can see and act on this."                                                              |

Until Part 2/4 exist, every inbound Message's terminal state is `RECEIVED` — this is expected, not a bug.

## Why this belongs in Part-1, before Part-2 exists

Same reasoning as the domain event catalog (`docs/ADR-EVENTS-001`): defining the full state's shape now, even for values with no producer yet, means Part 2 and Part 4 extend an existing contract instead of renegotiating the `Message` schema's meaning after data already exists in it. A message document written today and a message document written after Part 2 ships use the same `MessageStatus` enum with the same meanings.

## What this document does not cover

- Conversation-level status (Open/Pending/Resolved/Closed, etc.) — that's a _separate_ state machine, owned by Part 2's Conversation entity (PRD-003 Part 2), not this document. A Message's status and its parent Conversation's status are independent axes.
- Any Part-3/Template-specific status values (e.g., template approval states) — out of scope for this document, will get their own state machine when Part 3 is built.
