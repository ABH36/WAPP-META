# Platform Dashboard Strategy

**Status:** Accepted
**Date:** 2026-08-12
**Scope:** FRD-001 Volume-8 — Platform Administration UI. How `apps/admin` implements the Platform Dashboard, Billing Operations, Global Audit Center, Analytics, Global Announcements, Feature Flags, and Maintenance Mode, plus this volume's responsive behaviour, on top of the frozen Platform Administration backend (PRD-007).
**Implemented in:** `apps/admin/src/features/platform/{dashboard-view,billing-operations-view,audit-view,analytics-view,announcements-view,feature-flags-view,maintenance-view}.tsx`, `apps/admin/src/app/(platform)/{billing,audit,analytics,announcements,feature-flags,maintenance}`, `packages/ui/src/components/{announcement-card,feature-flag-card,maintenance-banner}.tsx`

## Dashboard composition: `systemHealth` is flat, not Diagnostics' array shape

`PlatformDashboardSnapshot.systemHealth` is the shared `HealthChecks` type (`apps/api/src/health/health-check.service.ts`) — a flat object `{database, redis, queue, storage, email}: boolean`, not an array of `{name, status}` entries like Settings' `DiagnosticsSummary.checks` (an unrelated type despite the similar name). `dashboard-view.tsx` iterates `Object.entries(snapshot.systemHealth)` directly into `HealthStatusCard` (reused from FRD-001 Volume-7) rather than a `.checks.map()` call the Diagnostics pattern would suggest — this was corrected during implementation, before it reached Runtime Verification, by reading `health-check.service.ts` directly rather than trusting the naming similarity. `SummaryCard` (FRD-001 Volume-3) covers every headline tile; no bespoke "PlatformStatCard" was built.

## Billing Operations: the exact tenant Billing primitives, one composed screen

Since the platform Billing routes read and write the identical tenant Billing collections with identical field shapes, `billing-operations-view.tsx` reuses `InvoiceCard`/`PaymentCard` (FRD-001 Volume-6) verbatim rather than building platform-specific equivalents. The screen composes all three billing surfaces (Subscriptions/Invoices/Payments) behind local tab state with a shared `workspaceId` filter; Extend Trial, Change Plan, Void, and Refund all require an inline reason where the corresponding backend route expects one. Activate and Resume subscription share a single `status: "ACTIVE"` route with no way to distinguish operator intent server-side — both are exposed as the same status-change action, not two separate buttons implying a backend distinction that does not exist.

## Global Audit Center: no client-side event merging, ever

Only Break-Glass actions plus a curated subset of Platform Actions are natively persisted to `GET /platform/audit` — Billing Operations and Workspace Actions live in their own owners' audit trails and are never merged into this endpoint's response. Per the Architecture Review's explicit instruction, `audit-view.tsx` renders exactly what this one endpoint returns via `Timeline`/`TimelineItem` (FRD-001 Volume-5) and introduces no synthetic cross-endpoint timeline. The endpoint returns a flat `{items, total}` page (no `meta`, no echoed `page`/`limit`), so pagination is client-tracked (`page` state, `Math.ceil(total / PAGE_SIZE)`) rather than reused from `apps/web`'s nested `Paginated<T>` shape — matching the same flat-envelope convention every other Platform list route in this volume uses (`types/pagination.ts`'s `PlatformPaginated<T>`).

## Analytics: three real categories, snapshot comparisons not trend charts

`GET /platform/analytics` and `GET /platform/kpis` together cover only Platform KPIs, Revenue, and Workspace Growth — "User Growth," "Subscription Trends," and "Activity Trends" have no backend endpoint anywhere and are not represented (filed as Technical Debt, not fabricated). Neither endpoint returns time-series data, so `analytics-view.tsx` reuses `RevenueChart` (FRD-001 Volume-5) for categorical bar comparisons (Previous vs. Current Month Revenue, New vs. Total Workspaces, CRM Growth by entity, Feature Adoption by flag) rather than a trend line implying a history that does not exist on the backend. No bespoke "AnalyticsChart" component was built.

## Global Announcements: Create + List only, no fabricated lifecycle

No status field, scheduling, or Publish/Archive route exists on `PlatformAnnouncementController` — the domain event this fires has zero consumers, so nothing is ever actually delivered to a tenant. `announcements-view.tsx` and the new `AnnouncementCard` primitive expose only Create and List, with no Active/Scheduled/Expired badge or state, matching the Architecture Review's explicit "minimal Create + List only" instruction. The full announcement lifecycle (delivery, status, scheduling) is filed as Technical Debt.

## Feature Flags: single global tier, backend-padded

`PlatformFeatureFlagsService.list()` already pads all 5 `FeatureFlagKey` values with `enabled: null` for unset ones — confirmed by direct code read — so `feature-flags-view.tsx` needed no client-side padding, unlike Governance's policies. `enabled: null` ("Inherit," no platform override, falls back to the workspace-level default) is a genuine third state, rendered by the new `FeatureFlagCard` as its own neutral badge, never coerced to a boolean. Only a single global override per flag exists; "Workspace Overrides" has no backend support and is filed as Technical Debt. No route exists to clear an override back to "Inherit" once set, so the screen offers only Enable/Disable.

## Maintenance Mode: platform-wide, distinct from Settings' workspace toggle

`PLATFORM_MAINTENANCE_ENABLED` genuinely blocks tenant login platform-wide (`AuthService.login()`), a materially more powerful switch than Settings' workspace-scoped maintenance toggle (FRD-001 Volume-7) — the two are unrelated and neither reads nor writes the other's state. `maintenance-view.tsx` requires an inline reason before enabling, matching the backend's audit expectation, and omits "Started By"/"Started At" entirely — both are persisted in Mongo but never returned by `GET /platform/maintenance`, so the UI does not fabricate them. The new `MaintenanceBanner` primitive was corrected during implementation from an invalid `variant="success"` to `variant="info"` after confirming `Alert`'s real variant union (`info`/`warning`/`danger` only) by direct source read.

## Responsive behaviour

Every filter bar (Audit, Support, Billing Operations) uses `flex flex-wrap`; every multi-tile section (Dashboard, Analytics, Compliance) uses `grid-cols-1` with `sm:`/`md:`/`lg:` breakpoints, matching the responsive convention established in FRD-001 Volumes 3–7. `FeatureFlagCard`'s header row was tightened from a non-wrapping `flex items-center justify-between` to `flex flex-wrap items-center justify-between` during this volume's responsive pass — the only card in this volume dense enough (label, badge, up to two action buttons) to risk horizontal overflow on narrow viewports; every other new card follows the same two-element header pattern already in use across `packages/ui` since Volume-2, left unchanged as established precedent.
