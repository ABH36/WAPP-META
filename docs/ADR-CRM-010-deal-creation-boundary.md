# Deal Creation Boundary

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-3 (Lead Conversion) — the `deals` collection's minimal starting shape
**Implemented in:** `apps/api/src/modules/crm/schemas/deal.schema.ts`, `repositories/deal.repository.ts`

## Why `deals` exists before Deal Management (Part-4) has been reviewed

Volume-3 needs _something_ to create and reference as the outcome of conversion (§7: "a Deal must exist"), but Volume-3 does not define Deal's own business rules — pipeline stages beyond a starting value, close dates, value tracking, ownership/assignment, or any of Deal Management's own lifecycle. Rather than invent those rules ahead of PRD-004 Volume-4 being relayed and reviewed, `Deal` was scoped down to exactly what Volume-3 itself specifies:

```ts
{
  workspaceId, contactId, customerId,   // identity — same resolution pattern as Customer/Lead
  sourceLeadId,                          // permanent back-reference to the converting Lead
  stage: DealStage.NEW,                  // the one pipeline field Volume-3 touches, at its most conservative value
  createdBy, createdAt, updatedAt,
}
```

## The boundary: this collection is not replaced in Part-4, it's extended

`deals` is the real, permanent collection — not a staging table or a placeholder to be migrated away from. When PRD-004 Volume-4 (Deal Management) is reviewed and approved, it adds fields to this same `Deal` schema (value, expected close date, pipeline stage transitions beyond `NEW`, assignment, notes, etc.) the same way Volume-2 added fields to `Lead` without touching Volume-1's `Customer`. A second `deals`-like collection was deliberately avoided — there is exactly one place a Deal record lives, from the moment Lead Conversion creates it onward.

## `sourceLeadId` is the permanent, immutable link — and the structural conversion guard

`sourceLeadId` carries its own unique index (`DealSchema.index({ sourceLeadId: 1 }, { unique: true })`), declared standalone rather than via `@Prop({ index: true })` — the two together would have registered the field twice (Mongoose logged a "Duplicate schema index" warning during implementation, caught and fixed by removing the redundant `@Prop`-level flag).

This index is not just a data-integrity nicety: it's the structural backstop for Lead Conversion's idempotency guarantee (`docs/ADR-CRM-009-lead-conversion-strategy.md`, §10). `LeadConversionService` already checks `Lead.convertedAt` before opening a transaction, but a unique index on `sourceLeadId` means even a theoretical race between two concurrent `/convert` calls on the same Lead can't produce two Deals — the second `DealRepository.create()` inside the losing transaction would fail the unique constraint and the whole transaction rolls back, rather than silently succeeding twice.

`contactId` and `customerId` are populated directly from the converting Lead/Customer at creation time — Deal doesn't re-derive or re-resolve them independently, the same reuse-not-rebuild pattern already established for how Lead resolves Contact/Customer (`docs/ADR-CRM-006-lead-ownership-strategy.md`, `docs/ADR-CRM-008-customer-lead-relationship.md`).

## What this document does not cover

Deal's own lifecycle, pipeline-stage transition rules beyond the starting `NEW` value, value/close-date tracking, assignment/ownership, or any Deal-specific domain events beyond `DEAL_CREATED_FROM_LEAD` — all PRD-004 Volume-4 (Deal Management, Phase-5 Part-4) scope, not yet reviewed or approved.
