# COMM-010 — Automation Execution Policy

**Status:** Accepted
**Type:** Documentation of an already-implemented policy (no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-4a recommendation #1)

## Purpose

Part 4a's Welcome/Away automation was built to a set of reliability rules that were never written down as their own decision — they were derived from patterns already established elsewhere in Communication (webhook processing, the Conversation auto-close sweep). As more automation lands in Part 4b/4c, those rules need to be explicit so every future automation feature follows the same contract by design, not by re-deriving it from reading `AutomationService`'s source.

## Policy

**1. Automation always runs after successful message persistence, never before or interleaved with it.**
`WebhookController.receiveEvent()` queues the raw payload and acknowledges immediately; `WebhookProcessingProcessor` picks it up and calls `WebhookService.processEvent()` off the request path entirely. Inside `handleInboundMessage()`, the write order is fixed: `Contact` findOrCreate → `Conversation.recordActivity()` → `Message.create()` → `DomainEvent.MESSAGE_RECEIVED` emitted → **then** `AutomationService.maybeSendAutoReply()`. Automation reads a conversation/message state that has already durably landed — it never observes a partially-written inbound message.

**2. Automation must never block webhook acknowledgement.**
Already structural, not just a coding convention: the controller acknowledges (`200 OK`, `{ received: true }`) the instant the payload is queued via BullMQ, before `processEvent()` — and therefore before any automation — ever runs. Slow or failing automation logic has no path back to the HTTP response Meta sees.

**3. Automation must never roll back persisted business data.**
There is no transaction wrapping message persistence and automation evaluation together, and there must never be one. A Welcome/Away send failing (Meta rejects it, `MessageService.sendText` throws) does not undo the `Contact`/`Conversation`/`Message` writes that already committed — those represent a real inbound message that happened regardless of whether an automated reply could be sent.

**4. Automation must log failures without interrupting message processing.**
`AutomationService.maybeSendAutoReply()` is the single entry point `WebhookService` calls, and it is a hard boundary: `evaluateAndSend()` runs inside a try/catch that logs via `Logger.warn` and swallows every error, so a failure here can never propagate out and fail the surrounding `processEvent()` call (which would otherwise trigger the queue's retry/backoff machinery — see `webhook.controller.ts`'s `attempts: 3, backoff: exponential` — and risk reprocessing an already-persisted message just because its side-effect automation failed).

## What this ADR does not do

No code changes — every rule above describes `apps/api/src/modules/communication/services/{webhook,automation}.service.ts` as they already exist post-Part-4a. This ADR exists so Part 4b (Auto Assignment), Part 4c (SLA Monitoring + Escalation Rules), and any automation feature after them are built against the same four rules from the start, rather than each rediscovering them independently.
