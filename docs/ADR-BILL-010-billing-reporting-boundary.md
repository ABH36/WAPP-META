# Billing Reporting Boundary

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-4 — the canonical separation between Billing Reports (workspace-scoped) and future Platform Reporting (cross-tenant)
**Implemented in:** `apps/api/src/modules/billing/services/billing-reports.service.ts`, `apps/api/src/modules/billing/repositories/billing-reports.repository.ts`

## Workspace-scoped, not platform-wide

The relayed document's own dashboard card list ("Active Subscriptions," "Trial Workspaces," "Expired Workspaces," "Grace Period Workspaces," "Plan Distribution" — all plural, cross-cutting language) read like platform-wide analytics, while §Permissions specified "Reuse BILLING_ACCESS... No new permissions" — a tenant-scoped permission that has never gated anything beyond a single Workspace anywhere in this codebase. Resolved 2026-08-07, Architecture Review: **workspace-scoped**, matching every other Billing endpoint's identical security boundary. Every plural card becomes a single-Workspace 0/1 flag:

| Dashboard card          | Derivation                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active Subscriptions    | `1` if `Subscription.status === ACTIVE`, else `0`                                                                                                                                                                    |
| Trial Workspaces        | `1` if `Subscription.status === TRIAL`, else `0`                                                                                                                                                                     |
| Grace Period Workspaces | `1` if `Subscription.status === GRACE_PERIOD`, else `0`                                                                                                                                                              |
| Expired Workspaces      | `1` if `Workspace.status === EXPIRED`, else `0` — a broader signal than Grace Period alone, since ADR-BILL-002 maps both `GRACE_PERIOD` and non-payment `SUSPENDED` Subscription states to `WorkspaceStatus.EXPIRED` |
| Plan Distribution       | `[{ planName: <current Plan>, count: 1 }]` — a Workspace is on exactly one Plan at a time                                                                                                                            |

This directly confirms and follows a precedent already set inside this codebase before Volume-4 was even planned: `docs/ADR-CRM-021-crm-analytics-boundary.md` explicitly names "future modules (Billing, platform Reporting)" as two separate things — "Billing" (workspace-scoped, like CRM Reports) and "platform Reporting" (a distinct, not-yet-built, cross-tenant concept) were always meant to be different.

## Future Platform Reporting is a separate, not-yet-built concept

A genuine platform-wide, cross-tenant billing dashboard (e.g. WAPP's own internal team monitoring total revenue/subscriptions across every customer) is real, plausible future scope — but it belongs to Platform Administration (PRD-007), not this bounded context. It would need a genuine platform-operator permission model (`PlatformRole`, pre-scaffolded with zero live consumers today — see TD-010/TD-015) and a wholly new class of unscoped, cross-tenant aggregation query that does not exist anywhere in this codebase. Nothing in Volume-4's implementation forecloses that future work — `BillingReportsRepository`'s methods all take an explicit `workspaceId` and could, in principle, be composed differently by a future Platform Reporting module reading the same underlying Invoice/Payment/Subscription/Usage data — but Volume-4 itself makes no attempt to build it.

## Reuses CRM Reports' implementation shape directly

Precedent, not reinvention: a dedicated `BillingReportsRepository` bypassing Invoice/Payment's own CRUD repositories for aggregation (mirroring `docs/ADR-CRM-019-crm-reporting-strategy.md`'s "Reports is the sole cross-entity read layer" rule), `exceljs` for Excel export and hand-rolled CSV, a single `GET /billing/reports/export?type=X&format=Y` endpoint reusing each report's own computation method (no duplicated aggregation logic), and no caching (§Business Rules: "Reports always calculate from current state" — same deliberate simplicity-first choice `docs/ADR-CRM-019` already made, deferred as a future optimization if latency becomes a real problem, not overlooked — see TD-016).

## Two report types fold into existing endpoints rather than getting their own routes

§Reports names "Trial Report" and "Forecast" as separate reports, but §13's API surface lists no `/trial` or `/forecast` route — the same "feature list is broader than the shipped API surface" pattern already seen with Billing History (Volume-2, no `GET` endpoint at all). Trial Report folds into `GET /billing/reports/subscriptions` (a `trial: { isInTrial, trialEndsAt, daysRemaining }` field); Forecast folds into `GET /billing/reports/revenue` (a `forecast: { nextRenewalDate, expectedAmount }` field, computed the same way `InvoiceService.generateForSubscriptionUpgrade()` computes `Invoice.amount` — `null` until GTM pricing is approved, TD-009).

## Revenue is Payment-derived, not Invoice-derived — mostly unblocked by TD-009/TD-011

`Payment.amount` is a required, non-nullable field — always a real number, manually supplied by whoever records the Payment (Volume-2) — unlike `Invoice.amount`, which stays `null` until GTM pricing is approved. `BillingReportsRepository.sumPaidPaymentsInRange()`/`sumAllPaidPayments()` sum `Payment.amount`, not `Invoice.amount`, so Revenue figures are not structurally blocked by TD-009 the way Invoice/Forecast figures are — they will show `0` today only because no real Payments have been recorded yet in a pre-launch environment, not because of a `null` propagating through the aggregation. `InvoiceReport.totalAmount` is the one figure in this volume that stays genuinely `null` (not `0`) until real Invoice pricing exists, distinguishing "not yet known" from "confirmed zero."
