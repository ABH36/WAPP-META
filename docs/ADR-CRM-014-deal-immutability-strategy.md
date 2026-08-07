# Deal Immutability Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-4 (Deal Management) — the permanent-record guarantee
**Implemented in:** `apps/api/src/modules/crm/schemas/deal.schema.ts`, `controllers/deal.controller.ts`

## The permanent lifecycle

```
OPEN → QUALIFICATION → PROPOSAL → NEGOTIATION → WON
  │         │              │            │
  └─────────┴──────────────┴────────────┴──→ LOST → (reopen) → OPEN
```

A Deal, once created, exists forever. There is no `DELETE /crm/deals/:id`, no archive flag, no soft-delete mechanism of any kind on `Deal` — unlike every other CRM entity (Customer's `ARCHIVED` status, Lead's `archivedAt`), a Deal has no terminal "removed from view" state at all. `WON`/`LOST` are lifecycle outcomes, not deletions — a WON or LOST Deal is exactly as permanent and queryable as an OPEN one.

## Why no delete or archive, resolved

Volume-4 §18 states a Deal "shall never... lose audit history," and BR-008 requires history preservation — read literally rather than narrowed to only cover accidental data loss, these apply to intentional removal too (resolved during the Volume-4 Architecture Review, `docs/ADR-CRM-010-deal-creation-boundary.md`'s companion decision). §16's original API list included a `DELETE /crm/deals/:id` entry, but this was resolved as not implemented — reconciling that entry against §18's audit-preservation requirement and the absence of any archive-style field anywhere in §5's core field list.

This is a deliberate divergence from Customer/Lead, not an oversight: those entities represent business relationships that can legitimately become "no longer relevant" (a Customer stops being active, a Lead's opportunity dies) while the underlying record still has value as history — archival exists precisely to mark that without deleting. A Deal's own history _is_ the record of what happened to a specific pipeline opportunity; there's no further "inactive but still worth keeping" state to represent beyond `WON`/`LOST` themselves, since those already are the permanent outcome markers. Reopen (`docs/ADR-CRM-012-deal-lifecycle-strategy.md`) exists for the one case that needs undoing — a Deal marked LOST in error, or where the opportunity revives — but even reopen never removes the record of having been LOST; it just moves `stage` forward again, leaving `wonAt`/`lostAt`/`lostReason` history intact in whatever the last transition set them to.

## What this guarantees to future modules

Any module that references `dealId` (Activities/Tasks/Notes in Part-5, Reports/Forecasting in Part-6, and Lead's own permanent `dealId` back-reference from Part-3) can rely on that reference never dangling — a Deal is never removed once it exists, only ever transitioned. This is the same guarantee `sourceLeadId`'s permanence gives in the other direction (`docs/ADR-CRM-010-deal-creation-boundary.md`).
