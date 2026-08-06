# Lead Conversion State

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-3 (Lead Conversion) — canonical post-conversion behaviour
**Implemented in:** `apps/api/src/modules/crm/schemas/lead.schema.ts`, `services/lead.service.ts`, `services/lead-conversion.service.ts`

## The canonical shape

```
Lead (WON)
   │  LeadConversionService.convert()
   ▼
Historical Record
   │  convertedAt/convertedBy/dealId/customerId set, once, inside one transaction
   ▼
Immutable
   │  BR-006 — update/assign/updateStatus/archive all reject a converted Lead
   ▼
Referenced by Deal
   (Deal.sourceLeadId, permanent back-reference — docs/ADR-CRM-010-deal-creation-boundary.md)
```

A converted Lead does not disappear, merge into, or get superseded by its Deal — it remains a permanent, queryable record of how the opportunity originated (source, qualification history, who converted it, when). The Deal is the forward-looking record from that point on; the Lead is the backward-looking one. Neither replaces the other, and nothing deletes or archives a Lead as a side effect of conversion — archival is a separate, independent axis (`archivedAt`, `docs/ADR-CRM-009-lead-conversion-strategy.md`) that conversion doesn't touch.

## Why immutability, not deletion or status transition

Three things could have modeled "a Lead is done, converted, over": deleting it, adding a terminal `LeadStatus` value, or the approach actually taken — a separate `convertedAt` timestamp plus a blanket read-only rule. Deletion was never on the table (Leads are never hard-deleted anywhere in this module — `archivedAt` is CRM's only soft-delete mechanism, `docs/ADR-CRM-007-lead-state-machine.md`). A terminal status was rejected for the same reason `archivedAt` itself isn't a `LeadStatus` value: conversion is orthogonal to the qualification pipeline, not a step in it — `WON` already is the state-machine's terminal value, and conversion is something that happens _to_ a WON Lead, not a further stage of it (§4 lists "Not already converted" as an independent precondition, separate from status).

Practically, this means a Lead's `status` field permanently shows `WON` after conversion — the historical qualification outcome — while `convertedAt`/`convertedBy`/`dealId`/`customerId` separately record the conversion event itself. Both are visible on `GET /crm/leads/:id` going forward.

## What enforces immutability

`LeadService`'s four mutation paths (`update`, `assign`, `updateStatus`, `archive`) each check `lead.convertedAt` and reject with 400 before touching the repository — the same pattern already established for `archivedAt` (`docs/ADR-CRM-004-customer-archive-behaviour.md`'s Editing Policy). There is no code path that can mutate a converted Lead's business fields; the only writes `LeadRepository` will ever perform on it again are none — `markConverted` itself only ever runs once, guarded by the `ConflictException` idempotency check in `LeadConversionService.convert()`.
