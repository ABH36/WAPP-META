# CRM Reporting Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-6 (CRM Reports & Dashboard) — the boundary between transactional CRM modules and reporting
**Implemented in:** `apps/api/src/modules/crm/repositories/reports.repository.ts`, `services/reports.service.ts`

## No new collection — Reports is a read layer, not an entity

Every prior Phase-5 Part introduced a new persisted collection (`customers`, `leads`, `deals`, `activities`). Part-6 introduces none. §3 states Reports owns "Aggregations, KPI calculations, Dashboard widgets, Charts, Summary APIs" but explicitly not Customer/Lead/Deal/Activity themselves — and BR-004 forbids persisting forecast values at all. `ReportsRepository` therefore has no `create`/`update`/`archive` methods anywhere; every method is a read, most of them Mongo aggregation pipelines (`$group`, `$match`, `$facet`-adjacent multi-stage pipelines) rather than the simple `find`/`findOne` calls every other repository in this codebase uses. This is the first genuinely analytical (as opposed to transactional) read path in the system.

`ReportsRepository` injects `Customer`/`Lead`/`Deal`/`Activity`'s Mongoose models directly (`@InjectModel`), rather than routing through `CustomerRepository`/`LeadRepository`/`DealRepository`/`ActivityRepository`. Those repositories were designed for their own module's narrow CRUD/list needs (see each one's own `list()` method, single-collection, simple filters) — Reports' entire purpose is cross-entity aggregation those methods were never shaped for. Reading the same underlying models directly, already registered once in `CrmModule`'s `MongooseModule.forFeature`, avoids either bloating those repositories with report-specific aggregation methods or duplicating query logic.

## Read-only, dynamically computed, nothing cached

BR-001/BR-002 (read-only, never modifies transactional data) and BR-006 (values must reflect current database state) are structural, not just documented: there is no write path anywhere in `ReportsService`/`ReportsRepository`/`ReportsController`, and no report value is ever written back to any collection. Every dashboard number, rate, or forecast bucket is computed fresh on each request. This was a deliberate simplicity choice over introducing a caching/materialized-view layer — Phase-1 doesn't need dashboard responses to be sub-millisecond, and a stale cache would directly contradict BR-006's "current state" requirement. If report latency becomes a real problem at scale, that's a future, separate optimization — not something to pre-build here.

## Forecast: exactly Part-4's already-approved formula, nothing new

§9 restricts forecast calculations to Deal data only, computed dynamically, never persisted — this is the same boundary Deal Management's own `docs/ADR-CRM-013-forecast-data-strategy.md` already established when it explicitly deferred forecast _computation_ to this Part while keeping only the source fields (`value`, `probability`, `expectedCloseDate`, `stage`, `wonAt`, `lostAt`) on `Deal` itself. `ReportsRepository.sumForecastForStages`/`groupForecastByPeriod` use the identical `value × (probability / 100)` "Expected Revenue" formula Deal's own §9 defined — Part-6 doesn't invent a new forecasting model, it's the consumer Part-4's ADR was written anticipating.

## Two computed metrics are approximations, documented rather than hidden

Neither Lead nor Deal stores a full per-status-transition history — only current status plus `createdAt`/`updatedAt` (and, for Deal, the dedicated `wonAt`/`lostAt` fields BR-006 of Volume-4 added specifically for this purpose).

- **Average Sales Cycle** (§6) is precise: `Deal.wonAt - Deal.createdAt`, averaged over `WON` deals — `wonAt` is a real, purpose-built field.
- **Average Qualification Time** (§5) is an approximation: `Lead.updatedAt - Lead.createdAt`, averaged over Leads currently at or past `QUALIFIED` (`QUALIFIED`/`PROPOSAL_SENT`/`NEGOTIATION`/`WON`). `updatedAt` is a generic last-modified marker, not specifically "when this Lead became QUALIFIED" — a later, unrelated field edit (e.g. correcting a typo in `company`) would shift this number even though nothing about qualification changed. This is the best available signal without adding a new per-transition-timestamp field to `Lead`, which Volume-2 (already frozen) never defined and which would be new scope to introduce retroactively here.

## Export is not a new report shape — it's a serialization of the same six

`GET /crm/reports/export?type=X&format=csv|excel` (resolved 2026-08-07) computes the exact same report `X` would return from its own dedicated endpoint, then flattens it into rows and serializes. There's no separate "export data model" — `ReportsService.getReportRows()` calls the same `getDashboard`/`getLeadReport`/etc. methods the dedicated endpoints call, so the two can never drift out of sync with each other. CSV is hand-rolled (a few lines of comma/quote escaping — not worth a dependency for a well-understood, simple format); Excel uses `exceljs` (a new production dependency — genuinely necessary, since `.xlsx`'s binary format isn't something worth hand-rolling).
