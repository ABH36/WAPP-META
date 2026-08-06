# CRM-002 — Customer Lifecycle Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-1 recommendation #2)
**Implemented in:** `apps/api/src/modules/crm/services/customer.service.ts`, `packages/shared-types/src/enums/customer-status.enum.ts`

## The canonical lifecycle

```
ACTIVE --block--> BLOCKED
BLOCKED --activate--> ACTIVE
ACTIVE --archive--> ARCHIVED
BLOCKED --archive--> ARCHIVED
```

Three states (`CustomerStatus`: `ACTIVE | BLOCKED | ARCHIVED`), four legal transitions, enforced in `CustomerService.transitionStatus()` — every one of `block()`/`activate()`/`archive()` calls this one private method with an explicit `allowedFrom` list, rather than each writing its own ad-hoc status check. An out-of-list transition (e.g. `activate()` on an already-`ACTIVE` Customer, or `archive()` on an `ARCHIVED` one) throws `BadRequestException`, never silently no-ops or silently succeeds.

This replaces the pre-scaffolded `CustomerStatus` enum's original `ACTIVE | INACTIVE | BLOCKED` shape (`packages/shared-types`, written before PRD-004 was relayed) — `INACTIVE` had no lifecycle stage, no domain event, and no endpoint anywhere in the approved specification, so it was removed rather than kept alongside the three states PRD-004 actually defines. See `docs/project` history: this mismatch was the first of four ambiguities raised and resolved during PRD-004 Volume-1's Architecture Review.

## ARCHIVED is confirmed terminal

No transition in the table above leads out of `ARCHIVED` — `transitionStatus()`'s `allowedFrom` check makes this a structural fact, not just documentation: there is no code path that calls `updateStatus` with `ARCHIVED` as the _current_ status and succeeds. This is Customer Management's soft-delete mechanism (BR-003 — "Customer deletion is prohibited. Soft Delete only"): archiving is the only terminal action, and it's one-way by construction, not by a separate `isDeleted` flag layered on top of status the way `Contact`/`User` use elsewhere in this codebase.

## BLOCKED and ARCHIVED both stay fully visible

Per BR-004 ("Blocked customers remain visible") and BR-005 ("Archived customers remain searchable"): `CustomerRepository.list()`/`.search()` apply no implicit status exclusion — every status shows up unless the caller explicitly filters by `status`. This is a deliberate difference from how some systems treat "archived" as "hidden by default" — PRD-004 is explicit that archiving changes nothing about visibility, only about which further actions are legal.

## Status changes are dedicated endpoints, not the general PATCH

`block`/`activate`/`archive` are three separate endpoints (`PATCH /crm/customers/{id}/block` etc.), each requiring no request body, each emitting its own named domain event (`CUSTOMER_BLOCKED`/`CUSTOMER_ACTIVATED`/`CUSTOMER_ARCHIVED` — matching PRD-004 §16's explicit naming, not one generic "status changed" event the way `Conversation` uses `CONVERSATION_STATUS_CHANGED`). `UpdateCustomerDto` (the general `PATCH /crm/customers/{id}`) does not accept a `status` field at all — status can only move through the dedicated, validated transition methods.

## What this ADR does not do

No code changes — this documents the lifecycle Part-1 already implements. Lead's own status lifecycle (`LeadStatus`, already scaffolded with a distinct `UNQUALIFIED` vs `LOST` split — BDC-015) is a different state machine with different rules, decided in Part-2, not extended from this one.
