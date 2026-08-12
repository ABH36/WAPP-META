# Billing Dashboard Strategy

**Status:** Accepted
**Date:** 2026-08-11
**Scope:** FRD-001 Volume-6 — Billing UI. How `apps/web` implements the Billing Dashboard, Reports, and Forecast screens, plus their chart and responsive treatment.
**Implemented in:** `apps/web/src/features/billing/{dashboard-view,reports-view,forecast-view}.tsx`, `apps/web/src/app/(workspace)/billing/{,reports,forecast}`

## Dashboard composition: two report endpoints, no client-side joins

`GET /billing/reports/dashboard` alone is narrower than the Dashboard's own §4.1 card list implies — it has no explicit `SubscriptionStatus` enum field, no `nextRenewalDate`, and only pending/paid invoice _counts_, not a full summary (confirmed by reading `billing-reports.service.ts` directly). `dashboard-view.tsx` therefore composes it with the separate `GET /billing/reports/subscriptions` call, which already resolves and joins `planId` into a readable `planName` server-side, plus `daysUntilRenewal` and `trial.{isInTrial,daysRemaining}` — the frontend never performs this join itself (Architecture Review, 2026-08-11: "No frontend aggregation or commercial calculations shall be introduced"). Two `GET` calls, zero derived business values.

## Revenue Forecast is deliberately thin — no Renewal Forecast, no Trial Conversion

The backend's only forecast data is `RevenueReport.forecast: {nextRenewalDate, expectedAmount}`, folded into the Revenue Report with no dedicated `/forecast` route (`ADR-BILL-010`). `forecast-view.tsx` renders exactly these two fields as two `SummaryCard`s — nothing more. "Renewal Forecast" (a multi-period or likelihood-based projection) and "Trial Conversion" (a conversion-probability figure) were both named in the original planning document but have zero backend representation anywhere; per the Architect's explicit approval ("Forecast is intentionally minimal... Renewal Forecast and Trial Conversion Forecast are excluded because no backend support exists"), neither was approximated client-side — both are filed as Tech Debt (see `docs/TECH-DEBT.md`) rather than built against invented data.

## Reports: all 6 backend-supported endpoints exposed, unlike CRM's partial scope

`billing-reports.controller.ts` has exactly 6 read routes (`dashboard`, `revenue`, `invoices`, `payments`, `subscriptions`, `usage`) plus one `export` route — and FRD-001 Volume-6's planning document named exactly these 6 report types, so unlike CRM's Volume-5 Reports (which had to drop 2 of 5 named types for lacking backend support), Billing's Reports screen needed no scope cuts: every named report has a real, working endpoint. Each of the 6 sections on `reports-view.tsx` composes its own `SummaryCard` grid plus, where the response includes a distribution-shaped field (`monthlyBreakdown`, `countByStatus`), a `RevenueChart` — reusing the same Recharts primitive CRM's Volume-5 introduced, no new chart component needed. "Trial Report," named separately in some planning language, is not a standalone section — it's already folded into the Subscription Report's `trial` sub-object by the backend itself (`ADR-BILL-010`), and the UI mirrors that structure rather than inventing a seventh section.

## Export reuses the exact authenticated-blob pattern CRM established

`GET /billing/reports/export` is a binary stream (`@Res()`, bypassing the JSON envelope) requiring the same in-memory-only Bearer token every other Billing call does — `billingService.exportReport()` calls through `apiClient.get(url, {responseType: "blob"})`, identical in shape to `crmService.exportReport()` (FRD-001 Volume-5), and reuses the existing `lib/download-blob.ts` helper rather than writing a second one. One naming detail carried through carefully: `ExportBillingReportType`'s `"subscription"` value is singular, while the live report route it corresponds to is `/billing/reports/subscriptions` (plural) — the export type string and the report route are not the same string, confirmed against the real DTO rather than assumed.

## No RevenueCard, ForecastCard, or SubscriptionBadge — existing primitives already cover the shape

Consistent with the precedent CRM's Volume-5 set (`ReportCard`/`ForecastCard` not built, reusing `SummaryCard`): Billing's own §7-named `RevenueCard` and `ForecastCard` are exactly `SummaryCard`'s "label + value + description" shape and were not built as separate components. `SubscriptionBadge` likewise wasn't built — `StageBadge` (introduced in Volume-5) is already a generic "any status string via `getStatusColor`" wrapper, reused as-is for `SubscriptionStatus`/`InvoiceStatus`/`PaymentStatus`. `BillingHistoryTimeline` was not built at all — the Billing History screen was dropped this volume (no tenant-facing endpoint exists; see `docs/TECH-DEBT.md`).

## Responsive behaviour: card-based by construction, no tables to convert

Every Billing list (Invoices, Payments, available Plans) uses card primitives (`InvoiceCard`, `PaymentCard`, `PlanCard`) in a `flex flex-col` or responsive `grid`, never a `<Table>` — so §12's "tables→cards on mobile" requirement was satisfied by construction, the same outcome CRM's Volume-5 reached. `SummaryCard` grids across Dashboard/Reports/Forecast use `grid-cols-2 md:grid-cols-4` (or `md:grid-cols-2` for Forecast's two-card layout), collapsing cleanly on narrow viewports; `RevenueChart`'s own `ResponsiveContainer` handles chart width without any Billing-specific responsive code.
