# CRM-004 — Customer Archive Behaviour

**Status:** Accepted (with one named open gap — see below)
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-1 recommendation #2)
**Implemented in:** `apps/api/src/modules/crm/services/customer.service.ts`

## What ARCHIVED means today, confirmed against the actual code

- **Terminal.** `CustomerService.transitionStatus()`'s `allowedFrom` lists never include `ARCHIVED` as a source — no call path moves a Customer _out_ of `ARCHIVED` (`docs/ADR-CRM-002-customer-lifecycle-strategy.md`). This is Customer Management's soft-delete mechanism (BR-003); there is no separate `isDeleted` flag.
- **Searchable.** `CustomerRepository.list()`/`.search()` apply no implicit status exclusion (BR-005) — an `ARCHIVED` Customer appears in every list/search result unless the caller explicitly filters `status=ACTIVE` (or similar) to exclude it.
- **Relationship preserved.** Archiving never touches `Customer.contactId` — the link to its Contact (and therefore its full Conversation/Message history, Communication-owned) is untouched by status.
- **Deal / Activity references.** Not yet applicable — neither entity exists yet (Part-4/Part-5). Whatever foreign key they eventually hold to `Customer` will need its own read, since Customer's status has no cascading effect on anything today; there is nothing else in the system that currently reads `Customer.status` at all.

## The one gap this ADR names explicitly: "Read-only" is not enforced today

`CustomerService.update()` — the general `PATCH /crm/customers/{id}` handler — performs no status check before writing. **An `ARCHIVED` (or `BLOCKED`) Customer's business-profile fields (company, email, address, notes, etc.) can currently still be edited via the general update endpoint.** Only `mobileNumber`/`source`/`status` are protected from this path (by `UpdateCustomerDto`'s shape and the dedicated block/activate/archive endpoints, per ADR-CRM-002) — nothing stops, say, changing an `ARCHIVED` Customer's `companyName`.

This was not a decision made during Part-1's review — it's simply what the code does today, surfaced now because this recommendation asked for archive semantics to be documented precisely. Two ways to close it, neither implemented by this ADR:

1. **Enforce true read-only** — `CustomerService.update()` rejects (`BadRequestException`) any edit attempt when `customer.status === ARCHIVED`, the same guard style `transitionStatus()` already uses for status changes.
2. **Leave it editable** — treat `ARCHIVED` as "can't be actioned/assigned/converted" but not "frozen," on the reasoning that correcting a typo in an archived record's address is a reasonable administrative action that shouldn't require un-archiving first.

Both are defensible; PRD-004 Volume-1 doesn't say either way (§7's lifecycle diagram and BR-003/BR-005 describe visibility and terminality, not editability), so this is named as an open question for confirmation, not resolved unilaterally.

## What this ADR does not do

No code changes — the read-only gap above is documented, not fixed. If the Product Owner/Architect confirms option 1, that's a small, contained addition to `CustomerService.update()` (one status check, matching an existing pattern) for a future pass, not a Part-1 regression to correct retroactively.
