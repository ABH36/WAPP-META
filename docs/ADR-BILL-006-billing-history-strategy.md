# Billing History Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-2 §6/§10 — the canonical relationship between Subscription events, Invoice generation, Payment recording, Refunds, and the immutable Billing History timeline, consolidated into one reference document per Architecture Review recommendation
**Implemented in:** `apps/api/src/modules/billing/listeners/billing-history.listener.ts`, `apps/api/src/modules/billing/services/billing-history.service.ts`, `apps/api/src/modules/billing/repositories/billing-history.repository.ts`

This document is the single authoritative reference for Billing History — consolidating reasoning already established in `docs/ADR-BILL-004-invoice-payment-relationship.md` and `docs/ADR-BILL-005-billing-event-strategy.md` into one place Volume-4 (Billing Reports & Admin, the expected first reader) can cite without re-deriving.

## Billing History is a projection, never a fourth writer

`BillingHistoryEntry` is written exactly one way: `BillingHistoryListener` reacts to a Billing domain event and calls `BillingHistoryService.record()`. No other service — `SubscriptionService`, `InvoiceService`, `PaymentService` — ever writes to `billing_history_entries` directly. This is the same write-on-event pattern already established for CRM's Activity Timeline (`docs/ADR-CRM-015-activity-timeline-strategy.md`): a materialized log built from events already being emitted for other reasons, not a live cross-collection join and not a parallel bookkeeping path a service author could accidentally forget to update.

## The full event -> entry mapping

Every event below produces exactly one `BillingHistoryEntry`, tagged with the raw `DomainEvent` constant (not a hand-written label) so each entry stays traceable back to the exact event that produced it:

| Domain event              | Billing History description             |
| ------------------------- | --------------------------------------- |
| `SUBSCRIPTION_CREATED`    | Subscription created                    |
| `TRIAL_STARTED`           | Trial Started                           |
| `TRIAL_EXPIRED`           | Trial Expired                           |
| `SUBSCRIPTION_ACTIVATED`  | Subscription Activated                  |
| `SUBSCRIPTION_UPGRADED`   | Plan Changed (Upgrade)                  |
| `SUBSCRIPTION_DOWNGRADED` | Plan Changed (Downgrade Queued)         |
| `SUBSCRIPTION_CANCELLED`  | Subscription Cancelled                  |
| `GRACE_PERIOD_STARTED`    | Grace Period Started                    |
| `SUBSCRIPTION_SUSPENDED`  | Subscription Suspended                  |
| `INVOICE_GENERATED`       | Invoice Generated (with invoice number) |
| `INVOICE_PAID`            | Invoice Paid                            |
| `INVOICE_OVERDUE`         | Invoice Overdue                         |
| `PAYMENT_INITIATED`       | Payment Initiated                       |
| `PAYMENT_PAID`            | Payment Received                        |
| `PAYMENT_FAILED`          | Payment Failed                          |
| `PAYMENT_REFUNDED`        | Refund Issued                           |

`BILLING_HISTORY_RECORDED` itself is deliberately excluded from this table — `BillingHistoryListener` does not subscribe to its own output (that would be an infinite loop); it exists purely as a downstream "something happened in Billing" signal for a future listener that doesn't care what.

§6's own example list ("Trial Started... Payment Received... Subscription Renewed... Refund Issued") maps onto the table above with one deliberate gap: there is no "Subscription Renewed" entry, because there is no `SUBSCRIPTION_RENEWED` event — Scheduled Renewal (automatic, unattended recurring billing) is §14 Out of Scope for this phase, so nothing in the current event catalog represents it. Adding a Billing History description for an event that doesn't exist would be inventing history for something that can't happen yet.

## Immutability is structural, not a convention

`BillingHistoryRepository` exposes exactly one method — `record()` — and no `update`/`delete`. §6/§13's "Immutable... never edited, never deleted" is therefore enforced by the repository's shape itself: there is no code path in this codebase that could mutate or remove an entry, not just a policy nobody happens to violate yet.

## No read API in Volume-2 — by design, not oversight

§11 lists no `GET /billing/history` endpoint. Billing History is being built as infrastructure in this volume — the schema, the write path, the full event coverage — with its read surface deferred to Volume-4 (Billing Reports & Admin), the volume whose own stated purpose is reporting and dashboards. Building a bespoke read endpoint now, ahead of knowing Volume-4's actual query/filter/aggregation needs, risks shaping the wrong API twice.

## Relationship to a future platform-wide Audit module

PRD-007's Global Audit module does not exist in this codebase yet (`docs/project_wapp_event_driven_integration_standard` — Audit/Notification/Analytics are later, unbuilt cross-cutting modules). Billing History is not a stand-in for that future module and is not expected to be superseded by it: Billing History is a business-facing commercial timeline scoped to one Workspace's own Billing activity (what CRM's Activity Timeline is to CRM), while Global Audit is expected to be a platform-wide, cross-module technical/security trail. The two can coexist — a future Global Audit listener could subscribe to the same Billing events Billing History already does, independently, with no coupling between the two.
