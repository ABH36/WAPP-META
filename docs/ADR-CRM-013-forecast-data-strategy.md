# Forecast Data Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-4 §9/§10 (Revenue Tracking, Forecasting) — the boundary between Deal Management and CRM Reports & Dashboard
**Implemented in:** `apps/api/src/modules/crm/schemas/deal.schema.ts`

## Deal Management owns only the source data

§10 lists Forecasting (Pipeline/Won/Lost/Monthly/Quarterly/Yearly) as a Volume-4 objective, but §16's API surface has no forecast-aggregation endpoints, and the approved Phase-5 sequence puts CRM Reports & Dashboard in its own later part (Part-6). Resolved during Architecture Review: Part-4 is data-readiness only. The fields it stores are exactly what a forecast needs to be computed from, later, by whatever module owns reporting:

- `value`, `probability` — §9's "Expected Revenue = Value × Probability" inputs.
- `expectedCloseDate` — the time axis for Monthly/Quarterly/Yearly bucketing.
- `stage` — distinguishes open pipeline from closed.
- `wonAt`, `lostAt` — the actual close event and its timing, for Won/Lost forecast accuracy (using `expectedCloseDate` alone would conflate planned vs. actual).

No aggregation query, endpoint, or computed `expectedRevenue` field exists anywhere in Part-4. `DealRepository.list()`'s filters (`stage`, `assignedTo`, `customerId`, `expectedCloseFrom`/`expectedCloseTo`) support building a pipeline _view_ — a Reports module can query "all OPEN Deals with expectedCloseDate this quarter" — but computing and presenting an actual forecast number is explicitly out of scope here.

## Why this boundary, not the other one

The alternative — building forecast endpoints now — was rejected because it would mean either duplicating aggregation logic when Part-6 is built, or having Part-6 consume Part-4's forecast endpoints as its own data source instead of computing from raw Deal records directly, an unnecessary indirection. Keeping a clean transactional-data/analytical-reporting split (the same reasoning the Architect gave in approving this resolution) means Part-6 reads `deals` directly for whatever aggregation shape it needs, without Part-4 having guessed at that shape in advance.
