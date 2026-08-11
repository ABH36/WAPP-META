# Workspace Dashboard Strategy

**Status:** Accepted
**Date:** 2026-08-11
**Scope:** FRD-001 Volume-3 §4.1/§4.8 — the Workspace Dashboard (`/dashboard`). Identity summary, Quick Actions, and the cross-module Summary Cards, and the Dashboard's place in the app's information architecture relative to the new `/workspace/*` management section.
**Implemented in:** `apps/web/src/app/(workspace)/dashboard/page.tsx`, `apps/web/src/features/workspace/{workspace-identity-panel,workspace-summary-cards}.tsx`, `apps/web/src/services/{billing,crm}.service.ts`

## `/dashboard` is the home widget grid; `/workspace/*` is the management section — resolved, not assumed

The original FRD text named both "Workspace Dashboard" (§4.1) and a `/workspace` route prefix (§5) without stating how they relate, and separately listed "Dashboard" and "Workspace" as two sidebar items (§6). Architecture Review, 2026-08-10, resolved this explicitly: §4.1's identity summary and Quick Actions, plus §4.8's Summary Cards, both render at the existing `/dashboard` route — replacing FRD-001 Volume-1's placeholder, whose own comment already deferred exactly this content to "the Workspace module." `/workspace/*` became the five-page management section (`ADR-FE-005`). No standalone `/workspace` index page exists; the sidebar's "Workspace" item deep-links straight to `/workspace/profile`. `workspace-sidebar.tsx` was updated to mark both items active based on the real current path (`usePathname`) rather than the hardcoded `active` boolean Volume-1 shipped when Dashboard was the only link.

## Summary Cards: three data sources, not one aggregation call — because no aggregation endpoint exists

`workspace-summary-cards.tsx` makes four separate reads (`billing/subscription`, `billing/plans`, `billing/reports/dashboard`, `crm/reports/dashboard`) rather than one bundled call, because the backend has no such endpoint. This was confirmed, not assumed, during Architecture Review by grepping the entire Communication module for anything dashboard-shaped and finding nothing — only per-entity stats routes (`broadcasts/:id/stats`, `campaigns/:id/stats`, etc.), none of which aggregate to a workspace-wide summary. **Communication Overview is intentionally omitted from this volume's Summary Cards** — building a client-side aggregation from per-broadcast/per-campaign calls was explicitly rejected (slow, incomplete, architecturally messy for a dashboard card) in favor of shipping Subscription/Billing/CRM only and filing the gap as Tech Debt (see `docs/TECH-DEBT.md`, TD-025) for a future, properly-scoped backend addition.

## Billing-gated cards are hidden entirely, never shown in a restricted state

`BILLING_ACCESS` is Owner=FULL, Administrator=VIEW_ONLY, every other role=NONE. Rather than rendering a locked/restricted placeholder for the Subscription and Billing cards, `workspace-summary-cards.tsx` gates their queries on `useHasPermission(Permission.BILLING_ACCESS)` and renders nothing in their place for ineligible roles — resolved via `AskUserQuestion` during Architecture Review as the Recommended option, matching the same "frontend permission rendering is convenience only" principle `ADR-FE-001`/`ADR-FE-003` already established, and avoiding ever firing a request that's guaranteed to 403. The CRM card has no such gate — `VIEW_REPORTS` is never `NONE` for any `TenantRole` (every role gets at least a scoped view), so it always renders.

## "Trial Status" is derived from the same `status` enum, not a second API call

The approved Dashboard field list names "Status" and "Trial Status" as separate display items, but `WorkspaceProfile` has only one status field. Rather than reaching into `SubscriptionSummary.trialEndsAt` (which would tie the identity panel — visible to every role via `VIEW_WORKSPACE` — to a `BILLING_ACCESS`-gated read that most roles don't have), `workspace-identity-panel.tsx` derives "Trial status" purely from `status === WorkspaceStatus.TRIAL`. This keeps the identity panel readable by every workspace member regardless of billing permission, at the cost of not surfacing a trial-expiry date on the Dashboard itself — that information remains available to Billing-permitted roles via the Subscription card's `renewalDate`/`trialEndsAt` fields once a future Billing UI volume gives it a proper home.

## Quick Actions respect the same `EDIT_WORKSPACE` visibility split as the Workspace tabs

`workspace-identity-panel.tsx`'s Quick Actions list (Business Profile, Business Hours, Branding, Preferences — Notification Settings isn't a Quick Action per the original FRD's own §4.1 list) filters out Branding and Preferences for roles without `EDIT_WORKSPACE`, mirroring `ADR-FE-005`'s tab-visibility rule exactly rather than introducing a second, inconsistent permission check for the same two destinations.
