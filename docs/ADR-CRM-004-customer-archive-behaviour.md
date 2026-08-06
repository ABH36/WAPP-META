# CRM-004 — Customer Archive Behaviour

**Status:** Accepted
**Date:** 2026-08-06 (Customer Editing Policy resolved 2026-08-06)
**Raised by:** Architecture Review (PRD-004 Volume-1 recommendation #2)
**Implemented in:** `apps/api/src/modules/crm/services/customer.service.ts`

## Canonical Customer Editing Policy

| Status     | Editable via general update (`PATCH /crm/customers/{id}`) |
| ---------- | --------------------------------------------------------- |
| `ACTIVE`   | Yes                                                       |
| `BLOCKED`  | Yes                                                       |
| `ARCHIVED` | **No — read-only**                                        |

`CustomerService.update()` rejects (`BadRequestException`) any general-update attempt once `customer.status === ARCHIVED`, before it ever reaches `CustomerRepository.update()`. This is deliberately scoped to the _general_ update path only — the dedicated `block`/`activate`/`archive` endpoints (`transitionStatus()`) are unaffected by this check; `archive` itself is still how a Customer reaches this state in the first place.

## What ARCHIVED means, confirmed against the actual code

- **Terminal.** `CustomerService.transitionStatus()`'s `allowedFrom` lists never include `ARCHIVED` as a source — no call path moves a Customer _out_ of `ARCHIVED` (`docs/ADR-CRM-002-customer-lifecycle-strategy.md`). This is Customer Management's soft-delete mechanism (BR-003); there is no separate `isDeleted` flag.
- **Searchable.** `CustomerRepository.list()`/`.search()` apply no implicit status exclusion (BR-005) — an `ARCHIVED` Customer appears in every list/search result unless the caller explicitly filters `status=ACTIVE` (or similar) to exclude it.
- **Referencable / relationship preserved.** Archiving never touches `Customer.contactId` — the link to its Contact (and therefore its full Conversation/Message history, Communication-owned) is untouched by status. Nothing about `ARCHIVED` breaks or hides this reference.
- **Available for reporting.** Same reasoning as searchability — no reporting-side exclusion exists or is implied by status.
- **Available for historical Deals / Activities.** Neither entity exists yet (Part-4/Part-5), but the policy is set now so their eventual `customerId` reference has a clear rule to follow: an `ARCHIVED` Customer's historical Deals/Activities stay fully readable — only the Customer record's own business-profile fields become read-only, nothing referencing it is hidden or blocked.

## Why read-only, not left editable

The alternative (documented as option 2 in this ADR's original draft) was to treat `ARCHIVED` as "can't be actioned/assigned/converted" but not frozen for editing — e.g. allowing a typo fix without requiring un-archiving first. Rejected: `ARCHIVED` is meant to represent a closed chapter of the business relationship (BR-003's soft-delete framing); allowing silent edits after that point would let a record's history drift after the point it was supposed to become historical, undermining exactly the reporting/audit trail §22 (Success Criteria) names as a goal.

## What this ADR does not do

No changes to searchability, referencability, or the terminal lifecycle itself — those were already correct in Part-1 and are restated here for completeness, not changed. The only behavioral change from Part-1 is the `update()` read-only guard.
