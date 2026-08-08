# Webhook Delivery Strategy

**Status:** Accepted
**Date:** 2026-08-08
**Scope:** PRD-006 Volume-3 §4.3/§8 — who executes outbound webhook delivery, and how the Domain Event → Queue → HTTP Delivery → Retry → Dead Letter Handling pipeline is built
**Implemented in:** `apps/api/src/modules/settings/listeners/webhook-event.listener.ts`, `queue/webhook-delivery.service.ts`, `queue/webhook-delivery.processor.ts`, `repositories/webhook-config.repository.ts`, `repositories/webhook-delivery-log.repository.ts`

## Settings owns config and delivery — resolved, not assumed

§4.3 gives Settings the config (URL/secret/enabled/retry/timeout/events) but §3's "Business execution belongs to the owning bounded context" doesn't name an owner for the _act_ of delivering — no existing bounded context (Communication, CRM, Billing) does generic outbound HTTP relay today. Resolved 2026-08-08, Architecture Review: Settings owns delivery too, because delivery is not a business decision — it doesn't decide anything, it forwards an event a business module already decided and already emitted. This is the same class of work as the existing email queue processor (`infrastructure/email/`), not "business execution" in the BR-001 sense. `WebhookEventListener` never calls into CRM/Communication/Billing services and they never call into Settings — the coupling is entirely through domain events already emitted for other reasons, unchanged by this volume.

## The pipeline

```
Domain Event (CUSTOMER_CREATED, LEAD_CREATED, DEAL_WON,
MESSAGE_RECEIVED, CAMPAIGN_COMPLETED, INVOICE_PAID)
        │
        ▼
WebhookEventListener (@OnEvent, one method per event —
same one-per-event convention as billing-history.listener.ts)
        │  looks up every enabled WebhookConfig in that
        │  workspace subscribed to the matching WebhookEventType
        ▼
WebhookDeliveryService.enqueue()  →  BullMQ "webhook-delivery" queue
        │  attempts = webhook.retryCount + 1
        │  backoff = exponential, 5s base
        ▼
WebhookDeliveryProcessor (off the request path, same
WorkerHost pattern as WebhookProcessingProcessor)
        │  HMAC-SHA256-signs the body with the webhook's own
        │  decrypted secret (X-WAPP-Signature header),
        │  POSTs with an AbortController timeout = webhook.timeoutSeconds
        ▼
   success ──► WebhookDeliveryLog (insert-only) + WebhookConfig.status = CONNECTED
   failure ──► WebhookDeliveryLog (insert-only) + WebhookConfig.status = ERROR,
               throw → BullMQ retries per `attempts`/backoff
        │
        ▼ (all attempts exhausted)
   BullMQ's own failed-job set — the Dead Letter stage.
   No separate dead-letter collection: BullMQ already retains
   failed jobs with their full error history, inspectable via
   its own tooling, and WebhookDeliveryLog already has a
   permanent record of every individual attempt regardless of
   the job's final outcome.
```

## Why no new domain event was added for delivery

`WebhookEventType` (shared-types) maps 1:1 onto the 6 already-existing `DomainEvent` constants (`CUSTOMER_CREATED` → `crm.customer_created`, etc.) — a translation table, not a new event source. Business modules emit exactly what they already emit; `WebhookEventListener` is the only place that turns "a business thing happened" into "deliver it to configured webhooks." `DEAL_WON` maps from `DomainEvent.DEAL_STAGE_CHANGED`'s dedicated milestone event (`crm.deal_won`), the same event Billing's own listeners already consume for their own purposes — no coordination needed between listeners, `EventEmitterModule` fans out to every subscriber independently.

## Why one webhook config's secret never leaves the process it's decrypted in

`WebhookConfigRepository.findActiveByWorkspaceAndEvent()` (the listener's lookup) and `findByIdWithSecret()` (the processor's lookup) are the only two call sites that ever `.select("+secretEncrypted")` — every read exposed through `WebhookService`/`WebhookSummary` (the API-facing type) omits it entirely (`select: false` on the schema field itself, BR-002). Decryption (`TokenEncryptionService.decrypt`) happens once, inside `WebhookDeliveryProcessor.process()`, immediately before signing — the plaintext secret is never logged, never persisted, and never crosses a process boundary.
