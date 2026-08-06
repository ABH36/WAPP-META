# CRM-006 — Lead Ownership Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-2 recommendation #2)
**Implemented in:** `apps/api/src/modules/crm/{schemas/lead.schema.ts,services/lead.service.ts,controllers/lead.controller.ts}`

## Three creation methods, one endpoint, resolved precedence

`POST /crm/leads` (`CreateLeadDto`) accepts exactly one of `mobileNumber` (Method 1, Manual Entry), `contactId` (Method 2, WhatsApp Conversation), or `customerId` (Method 3, Existing Customer Upsell Opportunity). `LeadService.create()`'s resolution order, when more than one is supplied: `customerId` wins over `contactId`, which wins over `mobileNumber`. Method 1 reuses `ContactRepository.findOrCreate` (the same cross-module call `CustomerService` already makes — `docs/ADR-CRM-001-customer-identity-strategy.md`); Method 3 reads the Customer's own `contactId` directly rather than re-resolving anything.

## The auto-link rule applies to every method, not just Method 3

§11: "If a Customer already exists for the same Contact: Lead shall reference that Customer instead of creating duplicate business identity." This isn't scoped to Method 3 in the PRD text, and `LeadService.create()` implements it that way — after resolving `contactId` by _any_ method, if `customerId` wasn't already set (i.e. Method 1 or 2), it checks `CustomerRepository.findByContactForWorkspace` and links automatically if found. A Sales Executive manually entering a lead for a phone number that already has a Customer record gets it linked without needing to know that Customer exists.

## Duplicate prevention is scoped to "active," unlike Customer's permanent link

Customer enforces one Customer per Contact, permanently (`ADR-CRM-001`). Lead is different: §11/BR-005 prohibit duplicate _active_ Leads per Contact, meaning a Contact can accumulate multiple Leads over time once earlier ones reach a terminal status (`WON`/`LOST`/`UNQUALIFIED`) or are archived — a real upsell scenario needs exactly this (Method 3 exists specifically to open a new Lead against a Contact that already converted once). Enforced via a **partial** unique index (`workspaceId, contactId`, filtered to `LEAD_ACTIVE_STATUSES` and `archivedAt: null`) rather than Customer's plain unique index, plus the same friendly-pre-check-before-DB-constraint pattern (`LeadRepository.findActiveByContactForWorkspace`, `ConflictException`).

## Archive is a separate flag, not an 8th status — resolved 2026-08-06

`Lead.archivedAt: Date | null`, independent of `status`. A Lead can be archived from any status (including terminal ones) without that being a stage transition — mirrors `Contact.isDeleted`'s shape, not Customer's status-is-terminal approach. `PATCH /crm/leads/{id}/archive` and `Lead Archived` (§17/§19) are a distinct mechanism from the generic `/status` endpoint for exactly this reason.

**Lead Editing Policy — applied by the same reasoning as `ADR-CRM-004`, not asked about separately.** Once `archivedAt` is set, `update()`/`assign()`/`updateStatus()` all reject with `BadRequestException` — the same "archived is read-only, but stays searchable/referencable" policy the Architect confirmed for Customer, extended here as a direct, low-risk application of an already-established project-wide principle (BR-008's soft-delete framing mirrors Customer's BR-003 exactly). Flagged here for visibility, since it wasn't a separate confirmed decision for Lead specifically.

## Assignment — eligible pool is SALES_EXECUTIVE specifically, not everyone with Lead access

§10: "assigned to one Sales Executive" — a narrower pool than everyone `PERMISSION_MATRIX` grants Lead mutation access to (Owner/Administrator/Sales Manager also have `UPDATE_LEAD_STAGE`, but aren't eligible _assignees_). `LeadService.assign()` validates the target user's `workspaceId`/`workspaceMemberStatus`/`role` explicitly (`LEAD_ELIGIBLE_ASSIGNEE_ROLES = [SALES_EXECUTIVE]`), the same shape `ConversationService.assign()` already uses for its own eligibility check. `assignedUserId: null` unassigns through the same endpoint (`LEAD_UNASSIGNED` vs. `LEAD_ASSIGNED`) — no separate unassign route, matching §19's single `/assign` endpoint.

## Permission model — reused, not expanded

Every Lead mutation endpoint (general update, assign, status change, archive) is gated by the existing `UPDATE_LEAD_STAGE` permission, reused broadly rather than adding a dedicated `EDIT_LEAD`/`ASSIGN_LEADS` permission — per the Architect's explicit instruction to verify the existing model before expanding `PERMISSION_MATRIX`, and the confirmation that no PRD-000C-defined permission was being missed by this codebase's scaffold (unlike `CustomerStatus`'s stale `INACTIVE`, this was a case where reuse was in fact correct). `CREATE_LEADS`/`VIEW_LEADS` keep their own literal meaning.

## What this ADR does not do

No code changes — this documents the ownership/identity strategy Part-2 already implements. Lead Conversion's own Customer-creation-or-link mechanics (Volume-3/Part-3) will reuse `CustomerService`/`CustomerRepository` the same way Lead reuses `ContactRepository`, not decided further here.
