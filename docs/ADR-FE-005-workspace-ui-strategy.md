# Workspace UI Strategy

**Status:** Accepted
**Date:** 2026-08-11
**Scope:** FRD-001 Volume-3 — Workspace UI. How `apps/web` implements Business Profile, Business Hours, Branding, Preferences, and Notification Settings on top of the frozen Workspace (PRD-003) and Settings (PRD-006 Volume-1) backends, without re-owning logic either module already owns.
**Implemented in:** `apps/web/src/{features/workspace,services,types,lib}`, `apps/web/src/app/(workspace)/workspace`, `packages/ui/src/components/{select,switch,textarea,summary-card,workspace-status-badge}.tsx`

## Read paths mirror the backend's own Workspace/Settings orchestration boundary, applied a second time

`ADR-FE-003` already established the frontend-service-split pattern for Identity/Settings (auth.service.ts vs. security-settings.service.ts). This volume applies the identical reasoning to Workspace/Settings: Business Profile, Business Hours, and Notification Settings are read via `workspaceService.current()` (`GET /workspaces/me`, gated `VIEW_WORKSPACE` — readable by every role) and written via `workspaceService`'s own `PATCH` routes, never touching `settings.service.ts`. Branding and Preferences are read and written entirely through `settingsService` (`GET /settings`, gated `EDIT_WORKSPACE`). This isn't just a file-organization choice — the two reads have genuinely different permission floors (see "Two tabs are hidden entirely" below), so keeping them on separate service files with separate query keys (`["workspace", "current"]` vs. `["settings", "overview"]`) means each page's data source module always matches its write-destination module exactly.

## Three factual corrections the planning document needed before implementation

Cross-referencing the real backend (not just the ADRs) during Architecture Review surfaced three assumptions in the original FRD text that don't match what's actually implemented — all resolved and approved 2026-08-10 before any code was written:

1. **Business Profile has no `website`/`address` fields.** `BusinessProfile` is only `{category, description, gstin}` (plus `name` at the workspace root, not inside `businessProfile`). `business-profile-form.tsx` displays `name` read-only and edits only the three fields that actually exist — nothing was invented to fill the gap.
2. **`WorkspaceProfile` doesn't expose `updatedAt`.** The Mongoose schema has it; the mapper omits it. "Last Updated" was dropped from `workspace-identity-panel.tsx` entirely rather than approximated from another field.
3. **"Current Plan" isn't a Workspace field at all.** It's sourced from `GET /billing/subscription` (`billingService.subscription()`), joined against `GET /billing/plans` (`billingService.plans()`) to resolve `planId` into a readable name — a detail the original planning document didn't spell out, since `PlanSummary` wasn't surfaced until this volume's implementation-time research. Same `BILLING_ACCESS` gate as the subscription read itself, so no new permission surface was introduced by adding it.

## Currency is display-only in the UI, even though the backend DTO would accept a write

`UpdatePreferencesDto.currency` has no enforced enum — the backend would technically accept any 3-character code. `preferences-form.tsx` renders it as plain read-only text anyway. BR-007 ("Currency is display-only. Billing remains INR-only") is treated as authoritative over what the API would technically permit, consistent with the approved India-only/INR-only beachhead (Business Decisions). This is a deliberate frontend restriction narrower than the API allows, not a bug — if a future volume needs multi-currency support, that's a business decision to make explicitly, not something the UI should pre-empt by exposing a control the backend doesn't actually mean to support yet.

## Theme has no workspace-level representation — the Preferences screen links out instead of duplicating it

`ADR-SET-003` establishes "personal preference" as strictly per-user (`UserPreferences`, keyed by `userId`, never shared across a Workspace). Theme lives entirely there, already wired in FRD-001 Volume-1's `theme-store`. Rather than inventing a second, workspace-scoped theme control that would have no backend field to persist to, `preferences-form.tsx`'s Theme row is a link into the existing Profile settings (Volume-2). Date format and time format are genuinely two-tier — a workspace default (this volume, `EDIT_WORKSPACE`-gated) with an independent per-user override (Volume-2's Profile, `ADR-SET-003`'s `EffectiveFormatSummary`) — the Preferences screen says so explicitly in its own copy, so an Owner changing the workspace default doesn't appear to (and doesn't) override what any individual member sees.

## Two tabs are hidden entirely for roles without `EDIT_WORKSPACE`, not just disabled

Business Profile, Business Hours, and Notification Settings read via `GET /workspaces/me` (`VIEW_WORKSPACE` — every role gets at least `VIEW_ONLY`), so those three tabs stay visible for every role, with their edit controls disabled (and an explanatory `Alert`) for anyone below `EDIT_WORKSPACE`. Branding and Preferences read via `GET /settings`, and — confirmed during Architecture Review research, not assumed — **every route on `SettingsController`, including the read, is gated `EDIT_WORKSPACE`** (Owner/Administrator only; every other role is `NONE`). A non-Owner/Administrator attempting either tab wouldn't get a degraded read-only view — the read itself would 403. `(workspace)/workspace/layout.tsx` filters those two tabs out of the nav entirely for such users (`useHasPermission(Permission.EDIT_WORKSPACE)`), and each feature component (`branding-panel.tsx`, `preferences-form.tsx`) independently guards against direct URL access with the same check before firing its query — the same "hide entirely, never a restricted placeholder" pattern the Architecture Review already approved for the Dashboard's Billing Summary Card, applied here as a mechanical extension rather than a new business decision.

## Business Profile Form / Business Hours Editor / Branding Panel / Notification Toggle List are app-specific, not shared components

Same reasoning `ADR-FE-003` already established for Login Form/Security Settings Panel: each of these binds to a specific service call, mutation, and query-invalidation wiring that has no reuse value outside `apps/web`'s Workspace feature. Only the presentational primitives they compose (`Select`, `Switch`, `Textarea`, `SummaryCard`, `WorkspaceStatusBadge`) were added to `packages/ui`, each because this volume is the first real screen that needs it — matching the pre-existing incremental-addition convention exactly. DS-001 §4 names no generic page-section-header pattern (title+description+action); rather than inventing an unapproved shared name, each Workspace page composes its own `<h2>` heading locally instead of introducing a `packages/ui` component with no approved name.

## Business Hours client-side validation catches two real edge cases before submit

`business-hours-editor.tsx`'s Zod schema (`superRefine`) rejects an open day whose opening time isn't strictly before its closing time, and rejects a duplicate holiday date — both flagged during Architecture Review as gaps the original planning document didn't address. The backend remains authoritative (these are convenience checks, not the source of truth), but catching them client-side avoids a round-trip for the most likely data-entry mistakes on a form with 7 day-rows and a free-form holiday list.

## Branding reuses the signed-upload flow exactly; "Replace" is the same code path as "Upload", not a second one

`branding-panel.tsx` calls `settingsService.getLogoUploadSignature()` → uploads directly to Cloudinary (`lib/cloudinary-upload.ts`, file bytes never touch `apps/api`, per SEC-016) → confirms via `settingsService.confirmLogo()`. The button label switches between "Upload logo" and "Replace logo" based on whether a logo already exists, but both paths call the identical three-step flow — the backend's own `confirmLogo` already deletes the previous Cloudinary asset when one exists, so no separate "replace" route or client branch was needed. "Remove logo" is the one genuinely distinct route (`DELETE /settings/branding/logo`).

## Summary Cards render with no `href` this volume

`/billing` and `/crm` don't exist as routes in `apps/web` yet — their own FRD volumes haven't shipped. `SummaryCard` supports an optional `href` (a real, tested capability), but `workspace-summary-cards.tsx` doesn't pass one for any of the three cards this volume ships. Linking to a route that 404s would have been a shipped defect, not a deferred nicety — the link target gets wired in whichever future volume actually builds `/billing` and `/crm`.
