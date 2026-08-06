# Customer–Lead Relationship

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-1 (Customer Management) + Volume-2 (Lead Management)
**Implemented in:** `apps/api/src/modules/crm/schemas/{customer,lead}.schema.ts`, `services/{customer,lead}.service.ts`

## The three-entity hierarchy

```
Contact (Communication-owned)
   ^                  ^
   |                  |
   | 1:1, permanent    | 1:1, permanent
   |                  |
Customer            Lead
(CRM-owned)         (CRM-owned)
   ^                  |
   |                  |
   +---- 1:many, optional, either direction ----+
       (Lead.customerId, nullable)
```

- **Contact** is the sole owner of "this phone number = this identity" (`docs/ADR-COMM-002-contact-ownership.md`, BDC-013). Neither Customer nor Lead ever stores WhatsApp-specific metadata (profile name, message history) — both reference Contact, neither duplicates it.
- **Customer** references exactly one Contact, permanently — enforced by a plain unique index (`workspaceId, contactId`) and immutable after creation (`docs/ADR-CRM-001-customer-identity-strategy.md`).
- **Lead** references exactly one Contact, but not permanently in the same sense — enforced by a _partial_ unique index scoped to active, non-archived Leads (`docs/ADR-CRM-006-lead-ownership-strategy.md`). A Contact can accumulate multiple Leads over time, once earlier ones reach a terminal status or are archived.
- **Customer ↔ Lead** is optional and many-to-one: a Lead may reference a Customer (`Lead.customerId`, nullable); a Customer may have zero, one, or many Leads over its lifetime (repeat upsell opportunities). Neither entity owns the other (PRD-004 Volume-2 §12) — a Lead can exist with no Customer yet, and a Customer can exist with no Lead having ever created it (Method 1/Manual Creation, Volume-1).

## The invariant: Lead creation must never duplicate Customer identity

Concretely, two mechanisms enforce this, both in `LeadService.create()`:

1. **Contact resolution never creates a second Contact for a number that already has one.** All three Lead creation methods funnel through the same `ContactRepository.findOrCreate`/`findByIdForWorkspace` calls Customer already uses — there is no Lead-specific Contact-creation path.
2. **The resolved Contact is always checked against Customer before the Lead is written.** Regardless of which creation method was used (Manual Entry, WhatsApp Conversation, or explicit Existing Customer Upsell), `LeadService.create()` calls `CustomerRepository.findByContactForWorkspace` whenever `customerId` wasn't already supplied directly, and auto-links the result. A Lead is never created "blind" to an already-existing Customer for the same Contact — the caller doesn't need to know one exists.

This means the invariant holds structurally, not just by convention: there is no code path in `LeadService` that can produce a Lead pointing at a Contact that already has a Customer, without that Lead's own `customerId` reflecting it.

## What this document does not cover

- Lead Conversion (PRD-004 Volume-3/Part-3) — the mechanism that creates a _new_ Customer (or links an existing one) from a `WON` Lead that had no `customerId` yet. This document describes the read-side relationship Volume-1/Volume-2 already established; Volume-3 is where the write-side conversion logic itself will live, reusing `CustomerService`/`CustomerRepository` the same way Lead already reuses `ContactRepository` (per `docs/ADR-CRM-006-lead-ownership-strategy.md`'s closing note).
- Customer Merge (`docs/ADR-CRM-003-customer-merge-strategy.md`) — a related but distinct future concern (two Customer records that should have been one), not decided here.
