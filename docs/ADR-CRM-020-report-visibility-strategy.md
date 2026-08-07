# Report Visibility Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-6 — workspace isolation, archived-record inclusion, dynamic aggregation, and permission gating
**Implemented in:** `apps/api/src/modules/crm/repositories/reports.repository.ts`, `controllers/reports.controller.ts`

## Workspace isolation

Every aggregation pipeline in `ReportsRepository` starts its `$match` stage with `{ workspaceId }` — via the shared `baseMatch()`/`leadMatch()`/`dealMatch()`/`activityMatch()` helpers every query method funnels through. There is no code path that aggregates across workspaces; BR-003 is enforced structurally, the same way every other CRM repository in this codebase scopes by `workspaceId` on every query, not as a Reports-specific addition.

## Archived and soft-deleted records are included, not filtered out

BR-005 says deleted/archived records "follow their owning module's visibility rules." Resolved during Architecture Review (2026-08-07): none of `ReportsRepository`'s `$match` stages exclude `archivedAt`-set or `ARCHIVED`-status documents. This isn't an oversight — it's the direct consequence of how those visibility rules already work in the modules that own them: an archived Customer stays queryable and reportable (`docs/ADR-CRM-004-customer-archive-behaviour.md` — archived means read-only, not hidden), and archived Leads remain searchable (confirmed in `lead.e2e-spec.ts`: "Archived Leads remain searchable"). "Total Customers" is a true grand total across every status; "Active Customers" is the separately-computed `status = ACTIVE` subset — the KPI names themselves, not a hidden visibility filter, are what narrow the count.

## Dynamic aggregation, not a stored view

Every count, sum, and average is computed at request time directly from the four source collections — there is no intermediate "reporting" collection, materialized view, or scheduled aggregation job anywhere in this Part (BR-006). A Deal that changes stage between two report requests is reflected immediately on the next request; there's no cache-invalidation problem to solve because there's no cache.

## Permission gating: `VIEW_REPORTS`, workspace-wide, resolved 2026-08-07

`VIEW_REPORTS` was already pre-scaffolded in the permission matrix with `TEAM_SCOPED`/`OWN_SCOPED`/`CAMPAIGN_SCOPED` grants for several roles — language that closely echoes §14's "Sales Executives receive reporting scoped to their permitted CRM data." Resolved during Architecture Review: those scoped levels stay unenforced. `ReportsController` gates every route with a plain `@RequirePermission(Permission.VIEW_REPORTS)`, and `PermissionsGuard` — the single enforcement point for every `@RequirePermission` in this codebase — only ever distinguishes `NONE` from everything else; it has never differentiated `FULL` from `TEAM_SCOPED`/`OWN_SCOPED`/`CAMPAIGN_SCOPED`, for `VIEW_REPORTS` or any other permission (`docs/ADR-CRM-017-activity-permission-strategy.md` documents the same binary behavior for `VIEW_CUSTOMERS`/`VIEW_DEALS`).

Building real per-row or per-team filtering was considered and deferred, for a reason specific to this permission: `TEAM_SCOPED` has no concept to scope by. Identity/Workspace's `TenantRole` model is flat — there is no manager-to-subordinate hierarchy, no "team" grouping field, anywhere in this codebase. Implementing `TEAM_SCOPED` filtering here would mean inventing a team/hierarchy concept as a side effect of a reporting document, rather than as its own reviewed, approved piece of the Identity/Workspace data model. `OWN_SCOPED` (filter to the actor's own assigned records) is more tractable on its own but was deferred alongside it for consistency, rather than half-implementing the scoped model (`OWN_SCOPED` enforced, `TEAM_SCOPED`/`CAMPAIGN_SCOPED` not) — a Sales Manager (`TEAM_SCOPED`) and a Sales Executive (`OWN_SCOPED`) currently see identical, full workspace-wide report data, confirmed in `reports.e2e-spec.ts`'s "a Sales Executive ... sees the same workspace-wide totals as the Owner" test.

Because access is workspace-wide rather than per-instance, `ReportsController` uses the ordinary static `@RequirePermission` decorator throughout — unlike `ActivityController` (`docs/ADR-CRM-017-activity-permission-strategy.md`), Reports never needed the inline, per-document permission-check pattern, since no single report response is "about" one specific record the way an Activity is about one specific Customer or Deal.

## Trigger to revisit

Real per-row/per-team report scoping should be built once (a) a team/hierarchy concept exists somewhere in Identity/Workspace for `TEAM_SCOPED` to mean something, and (b) there's an actual product requirement for a Sales Executive to see a narrower report than their manager — not invented here ahead of either.
