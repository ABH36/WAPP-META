# Settings Workspace Strategy

**Status:** Accepted
**Date:** 2026-08-12
**Scope:** FRD-001 Volume-7 — Settings UI. How the genuinely new Volume-7 screens (API Keys, Webhooks, Audit Logs, Data Export, Diagnostics) compose the frozen Settings backend, plus the specific Theme/Sidebar/Density migration and responsive treatment.
**Implemented in:** `apps/web/src/features/settings/{api-keys-view,webhooks-view,audit-log-view,export-view,diagnostics-view}.tsx`, `apps/web/src/lib/preference-sync.ts`

## Workspace orchestration and Branding workflow: confirmed unchanged, not re-documented here

`workspace.service.ts` (`GET/PATCH /workspaces/me/*`) and `settings.service.ts`'s existing `overview()`/branding methods (`GET /settings`, the Cloudinary signed-upload flow) are untouched by this volume — see `docs/ADR-SET-001-settings-ownership-strategy.md` and FRD-001 Volume-3's own `docs/ADR-FE-005-workspace-ui-strategy.md` for their original rationale, which still applies verbatim. `settings-home.tsx` only reads through `workspaceService.current()` and `settingsService.overview()` (the latter conditionally, since `GET /settings` is itself `EDIT_WORKSPACE`-gated, not just its writes — the same finding Volume-3 made for the Branding/Preferences tabs) — it never introduces a second write path for either.

## Theme/Sidebar/Density: why the migration, concretely

Before this volume, `theme-store.ts`/`ui-store.ts` were the _only_ representation of a user's theme and sidebar preference — pure `localStorage`, no server round-trip, no cross-device sync, and no relationship to the real `UserPreferences` Mongo document PRD-006 Volume-2 had already built and left unconsumed. The migration is deliberately additive at the call-site level, not a rewrite: `theme-store.ts` keeps its exact Zustand `persist` shape (still backed by `localStorage`, still the value every component reads synchronously on render), only its `Theme` type now aliases `@wapp/shared-types`'s real enum instead of a local string union. `lib/preference-sync.ts` layers the backend on top — `hydrateUserPreferences()` is the read path (called once per session, overwriting whatever `localStorage` had cached with the authoritative server value), `syncTheme`/`syncSidebar`/`syncDensity` are the write path (fired alongside every local `set` call, never awaited by the triggering UI). The net effect: a user who changes their theme on one device sees it on another after their next login, something that was structurally impossible before this volume, using a backend endpoint that had shipped in an earlier PRD-006 volume and simply never had a frontend consumer until now.

## API Keys and Webhooks: one-time secrets, never a second display

Both `apiKeysService.create()`/`rotate()` and `webhooksService.create()` return their secret exactly once, in the mutation's own response — confirmed by reading `SettingsApiKeysService`/`WebhookService` directly, not assumed from REST convention. `api-keys-view.tsx`/`webhooks-view.tsx` hold the just-generated secret in local component state only (never written to a TanStack Query cache, never persisted to `localStorage`), rendered in a dismissible warning panel the user must explicitly acknowledge ("I've copied it") before it's cleared — matching BR-004's "frontend never stores API secrets" literally, not just in spirit.

## Data Export: a single tracked job, not a job list

`DataManagementController` has exactly two routes — `POST settings/export` (create) and `GET settings/export/:id` (status) — no list-all-jobs endpoint exists anywhere, discovered during implementation (not part of the original Architecture Review's checklist, since the planning document's "Job List" language reasonably implied one). `export-view.tsx` adapts pragmatically: the backend already enforces at most one active job per workspace, so there is only ever one job worth tracking at a time. Its id is cached in `localStorage` (`wapp-web-last-export-job-id`) so status/download survives a page reload, and polled via TanStack Query's `refetchInterval` while `status` is `PENDING`/`PROCESSING`. "Download" is a plain anchor to `resultUrl` once `status: "COMPLETED"` — never a fetch-and-save flow, since no proxied binary-download route exists (confirmed against the controller directly).

## Diagnostics: read-only, workspace-scoped despite reporting infra state

`GET settings/diagnostics` is genuinely callable by any tenant user holding `VIEW_REPORTS` (confirmed via `SystemAdminController`'s guard, not the platform-only `apps/api/src/modules/platform` surface) — five of its six checks (database/redis/queue/storage/email) are platform-level and identical for every workspace, only `whatsapp` is workspace-specific. `diagnostics-view.tsx` renders exactly the `checks[]` array the backend returns via `HealthStatusCard`, no interpretation or aggregation beyond what the response already provides (BR-007).

## Responsive architecture

Every new screen inherited the same card-based, grid-first layout every prior volume established — no `<Table>` component anywhere in Volume-7's own code except the Preferences notification matrix, which wraps its `<table>` in `overflow-x-auto` for narrow viewports. `PreferenceCard` itself stacks label/control vertically below the `sm` breakpoint (`flex-col sm:flex-row`), and every `SummaryCard`/`HealthStatusCard`/`IntegrationCard` grid collapses to a single column on mobile via the same `grid-cols-1 md:grid-cols-*` pattern CRM and Billing already used — no Volume-7-specific responsive component was needed.
