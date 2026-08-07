# Invoice & Payment Relationship

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-2 — the ownership hierarchy between Subscription, Invoice, Payment attempts, and Billing History
**Implemented in:** `apps/api/src/modules/billing/services/invoice.service.ts`, `apps/api/src/modules/billing/services/payment.service.ts`

## The hierarchy

`Subscription` (Volume-1) → `Invoice` (one per plan change, generated internally) → `Payment` (many attempts per Invoice, at most one `PAID`) → `BillingHistoryEntry` (one immutable record per event anywhere in this chain). Each layer owns a narrower slice than the one above it, matching §3's explicit statement that Subscription never owns payment — see `docs/ADR-BILL-001-subscription-ownership-strategy.md` for why that boundary exists in the first place.

Invoice never modifies Subscription, Workspace, or CRM (§13) — the dependency runs the other way: `InvoiceGenerationListener` reacts to Subscription's own `SUBSCRIPTION_UPGRADED` event (fired unconditionally on every successful Upgrade call, whether or not it also activates — see `subscription.service.ts`). Payment never modifies Plan or Subscription (§13) either; it only ever touches its own Invoice, and only through `InvoiceService`'s narrow `markPaidFromPayment`/`markRefunded` methods, never a direct write.

## Invoice generation is internal, not user-triggered

§11 has no `POST /billing/invoices` — resolved 2026-08-07, Architecture Review: generation is entirely internal. Every successful `SubscriptionService.upgrade()` call — Trial-to-paid conversion and a plan change while already `ACTIVE` alike — produces exactly one new Invoice, created directly in `ISSUED` (no `DRAFT` authoring step exists in this volume's API surface). `amount`/`tax` are computed from `Plan.monthlyPrice`/`yearlyPrice` (keyed by the Subscription's `billingCycle`) and stay `null` while that pricing itself is unapproved (TD-009) — see TD-011 for why the null propagates into Invoice too, and why that's correct rather than a bug to route around.

## Payment recording is manual, not gateway-driven

§14 excludes Payment Gateway Integration, so `PaymentService.record()` has no async callback to wait on — every Payment is created `PENDING` (`PAYMENT_INITIATED`) and resolved to its final outcome (`PAID` or `FAILED`) synchronously, in the same call, by whoever is recording it. §9's "One Invoice may have multiple Payment attempts" and "Failed Payments remain historical" are both literal: a `FAILED` Payment is never mutated or deleted, and a retry creates a brand-new `Payment` document against the same still-`ISSUED` Invoice. "Duplicate Payment" (§12) concretely means an Invoice that already has a `PAID` Payment — recording a second one is rejected before a document is even created.

Who may call `POST /billing/payments`/`POST /billing/refunds` is deliberately narrower than `BILLING_ACCESS` alone would allow (`PermissionsGuard` is binary NONE-vs-not-NONE, so `BILLING_ACCESS` alone would let Administrator's `VIEW_ONLY` through too) — both endpoints additionally require `TenantRole.OWNER` specifically, in-service. This is a known, tracked interim gap, not the intended long-term access model — see TD-010.

## Refund closes both records together

A Refund (`PaymentService.refund()`) only accepts a `PAID` Payment ("Invalid Refund" otherwise) and, in the same call, moves both the Payment and its parent Invoice to `REFUNDED` — there is exactly one Payment per Invoice that can ever be `PAID` at a time (enforced by the Duplicate Payment check above), so "the Payment that closed this Invoice" is always unambiguous.

## Billing History is a projection, not a fourth writer

`BillingHistoryEntry` is never written directly by `InvoiceService`/`PaymentService`/`SubscriptionService` — it's populated entirely by `BillingHistoryListener` reacting to the domain events those services already emit, the same write-on-event pattern already established for CRM's Activity Timeline (`docs/ADR-CRM-015-activity-timeline-strategy.md`), not a live cross-collection join. See `docs/ADR-BILL-005-billing-event-strategy.md` for the full event catalog this listener subscribes to.
