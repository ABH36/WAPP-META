# Billing Event Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-2 §10 — the canonical Billing event flow from Subscription through Invoice, Payment, and Billing History
**Implemented in:** `apps/api/src/common/events/domain-events.ts`, `apps/api/src/modules/billing/listeners/`, `apps/api/src/modules/billing/queue/invoice-lifecycle.processor.ts`

## The full event chain

One Subscription-side action (Upgrade) cascades through the whole Billing module purely via domain events — no service calls another module's service directly for this:

```
SubscriptionService.upgrade()
  -> emits SUBSCRIPTION_UPGRADED (+ SUBSCRIPTION_ACTIVATED if it also activates)
     -> InvoiceGenerationListener -> InvoiceService.generateForSubscriptionUpgrade()
        -> emits INVOICE_GENERATED
PaymentService.record()
  -> emits PAYMENT_INITIATED, then PAYMENT_PAID or PAYMENT_FAILED
     -> (if PAID) InvoiceService.markPaidFromPayment() -> emits INVOICE_PAID
PaymentService.refund()
  -> InvoiceService.markRefunded() (no dedicated event — PAYMENT_REFUNDED covers it)
  -> emits PAYMENT_REFUNDED
InvoiceLifecycleProcessor (hourly sweep)
  -> InvoiceService.flagOverdueInvoices() -> emits INVOICE_OVERDUE (once per Invoice)

Every event above (and every Volume-1 Subscription event) ->
  BillingHistoryListener -> BillingHistoryService.record()
     -> emits BILLING_HISTORY_RECORDED
```

## Why SUBSCRIPTION_UPGRADED, not SUBSCRIPTION_ACTIVATED, drives Invoice generation

`upgrade()` emits `SUBSCRIPTION_UPGRADED` unconditionally and `SUBSCRIPTION_ACTIVATED` only when the call also moves the Subscription into `ACTIVE` (see `subscription.service.ts`). Listening to `SUBSCRIPTION_UPGRADED` alone covers both cases with exactly one Invoice per Upgrade call and zero risk of double-generating one from also listening to `SUBSCRIPTION_ACTIVATED` on the same request.

## Naming: PAID, not SUCCESS; PAYMENT_PAID, not PAYMENT_SUCCESSFUL

§5's literal wording ("SUCCESS") conflicts with the already-approved, platform-standardized `PaymentStatus` enum (`packages/shared-types/src/enums/payment-status.enum.ts`, ADR-039 — "'Success' retired in favor of 'Paid'"). Resolved 2026-08-07, Architecture Review: reuse `PaymentStatus.PAID` as-is. `PAYMENT_PAID` (the event name, not in §10's literal text either) follows from the same resolution and this catalog's existing convention of naming events after the resulting status (`CUSTOMER_BLOCKED`, `INVOICE_PAID` itself) — a natural, minimal extension of the naming decision, not a second one.

## PENDING is real, not decorative

Every Payment is created `PENDING` first (`PAYMENT_INITIATED`) and resolved to `PAID`/`FAILED` synchronously in the same call, because Volume-2 has no async Gateway callback (§14 Out of Scope) — "initiated" and "resolved" are back-to-back rather than genuinely time-separated, but both events fire for real, distinct reasons: a future Payment Gateway Integration volume could insert a real delay between them without changing this event shape at all.

## Invoice Overdue: a gap the relayed document left open

§10 lists `INVOICE_OVERDUE` as a required event, but nothing in the relayed Volume-2 text specifies a detection mechanism (flagged as a Missing Feature during Architecture Review). Resolved by direct extension of already-authorized scope — the same reasoning Volume-1's `SubscriptionLifecycleProcessor` was built under: the event exists in the approved catalog, so something has to produce it. `InvoiceLifecycleProcessor` is a second, separate hourly sweep (not folded into `SubscriptionLifecycleProcessor`, since it scans a different collection for a different condition) that flags each overdue Invoice exactly once, via a dedicated `overdueNotifiedAt` idempotency marker — `status` itself does not change; overdue is a notification, not a lifecycle transition (§4's lifecycle diagram has no `OVERDUE` state).

## Billing History Recorded is a literal, deliberate event

§10 lists "Billing History Recorded" as an event in its own right, not just the write of an entry. `BillingHistoryService.record()` writes the entry and then emits `BILLING_HISTORY_RECORDED` — a generic "something happened in Billing" signal for any future listener that only cares that _something_ changed, distinct from the specific event that triggered it. `BillingHistoryListener` does not subscribe to `BILLING_HISTORY_RECORDED` itself (would be an infinite loop), and — matching the explicit precedent already set by `DomainEventLoggerListener`'s own doc comment (EventEmitter2's wildcard listeners don't reliably survive NestJS class-method wrapping) — uses one explicit `@OnEvent` handler per Billing event rather than a `"billing.*"` wildcard.

## Fire-and-forget, eventually consistent — same as every prior module

`eventEmitter.emit()` (not `emitAsync()`) is fire-and-forget throughout this codebase, including here — a client that immediately re-reads right after an Upgrade call may observe the new Invoice arrive a moment later rather than instantly, the identical eventual-consistency property Volume-1's `WorkspaceCreatedListener` (reactive trial creation) already has. Not a new architectural risk introduced by this volume.
