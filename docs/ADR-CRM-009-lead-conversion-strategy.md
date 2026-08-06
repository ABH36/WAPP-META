# Lead Conversion Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-3 (Lead Conversion)
**Implemented in:** `apps/api/src/modules/crm/services/lead-conversion.service.ts`, `repositories/{lead,customer,deal}.repository.ts`

## What Lead Conversion is

A `WON` Lead becomes a `Customer` (new or reused) plus a `Deal`, atomically. This document covers the workflow itself — the write-side counterpart to `docs/ADR-CRM-008-customer-lead-relationship.md`, which described only the read-side Customer↔Lead relationship Volumes 1/2 established.

`LeadConversionService` owns no persistent entity of its own (§3); it orchestrates three existing repositories inside one Mongo transaction.

## Preconditions (§4), checked before a session is ever opened

In order: Lead exists → not already converted (idempotency, see below) → not archived → status is exactly `WON` → Workspace exists → Workspace is not read-only (`READ_ONLY_WORKSPACE_STATUSES`, reused verbatim from the canonical `WorkspaceStatus` access mapping in `packages/shared-types` — TRIAL and ACTIVE both mean full access, only EXPIRED blocks conversion).

Fail-fast is deliberate: every one of these can be answered from a single `findByIdForWorkspace` + `findById` read, so there's no reason to pay `startSession()`/transaction overhead for a request that's going to be rejected anyway. The unit suite (`lead-conversion.service.spec.ts`) asserts `startSession` is never called for any of these rejection paths.

## Customer resolution: reuse first, create only as a fallback

If `Lead.customerId` is already set (auto-linked at Lead creation, or supplied directly via the Existing Customer Upsell method — `docs/ADR-CRM-008-customer-lead-relationship.md`), conversion reuses it as-is; no new Customer is ever created for a Lead that already has one.

Only when `Lead.customerId` is `null` does conversion call `CustomerRepository.create()` with `source: CustomerSource.LEAD_CONVERSION` — the third and last value in `CustomerSource`, distinguishing "this Customer exists because a Lead converted" from WhatsApp-derived or manually-entered Customers (`docs/ADR-CRM-001-customer-identity-strategy.md`).

Either way, the Lead's own `customerId` field is rewritten during `markConverted` to reflect the outcome — a Lead that starts with no Customer link must not still show `customerId: null` after conversion just because the Deal itself is customerId-linked. (Caught and fixed during implementation verification: the first `LeadRepository.markConverted` draft only wrote `dealId`/`convertedAt`/`convertedBy`, silently leaving `Lead.customerId` stale for the new-Customer path — the e2e suite's `GET /crm/leads/:id` assertion after conversion caught this.)

## The transaction boundary

`session.withTransaction()` wraps exactly three writes: Customer resolution/creation, Deal creation, and `Lead.markConverted`. All three commit together or not at all — this is the first genuinely transactional write path in the codebase, made possible by the dev-environment replica-set change in `docs/ADR-INFRA-001-mongo-replica-set-strategy.md` (production, MongoDB Atlas, was already a replica set).

Domain events (`CUSTOMER_CREATED_FROM_LEAD` when a new Customer was actually created, `DEAL_CREATED_FROM_LEAD`, `LEAD_CONVERTED`) are emitted only after the transaction has committed successfully — never inside the `withTransaction` callback, since Mongo transactions can transparently retry on transient errors (`TransientTransactionError`), and a listener side effect must not fire more than once for one logical conversion.

## Idempotency (§10): 409, not a silent 200 or a second Deal

A repeat `/convert` call on an already-converted Lead throws `ConflictException("Lead has already been converted")` — no second Deal, no second Customer, no re-emitted events. This is a structural guarantee, not just an early check: `Deal.sourceLeadId` carries its own unique index (`docs/ADR-CRM-010-deal-creation-boundary.md`), so even a race between two concurrent `/convert` calls can't produce two Deals for the same Lead.

The original design called for the 409 body to carry the existing `leadId`/`customerId`/`dealId`/`convertedAt` directly, so a client wouldn't need a second round-trip. That doesn't actually work: the global `HttpExceptionFilter` (TAD-001 API-002's approved error envelope) only forwards an exception's `message` string to the client and drops any other fields on the exception's response object — a `ConflictException({message, ...extra})` call silently loses everything but `message` once it passes through the filter. Rather than widen the shared error envelope (a change with codebase-wide blast radius, well outside Lead Conversion's scope) to accommodate one endpoint, the fix was narrower: throw a plain string, and rely on `GET /crm/leads/:id` — which this same volume already extended to expose `dealId`/`convertedAt`/`convertedBy` — for the existing conversion result. Flagged here rather than silently decided because it changes the originally-described 409 contract; if a future volume needs structured error bodies more broadly, that's a TAD-001 API-002 revision, not a one-off exception.

## Converted Leads are read-only (BR-006)

Once `convertedAt` is set, `LeadService.update()`, `.assign()`, `.updateStatus()`, and `.archive()` all reject with 400 — the same read-only pattern `archivedAt` already established (`docs/ADR-CRM-004-customer-archive-behaviour.md`'s Editing Policy, extended to Lead's `archivedAt` in Volume-2). This is a second, independent axis from `archivedAt` (a converted Lead was never archived, and an archived Lead can't be converted — §4's two separate preconditions), so both checks exist side by side rather than collapsing into one flag.

This guard was missing from the initial implementation pass — added once it became clear PRD-004 Volume-3 §14's "converted Leads become read-only" business rule (BR-006) had no corresponding check anywhere in `LeadService`, only in the conversion path itself refusing to convert twice.
