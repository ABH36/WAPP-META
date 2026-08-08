# Support Ticket Lifecycle Strategy

**Status:** Accepted
**Date:** 2026-08-08
**Scope:** PRD-007 Volume-2 §4.6 — Support Tickets, the one genuinely new entity this volume introduces (everything else extends existing Billing state).
**Implemented in:** `apps/api/src/modules/platform/schemas/support-ticket.schema.ts`, `repositories/support-ticket.repository.ts`, `services/platform-support-tickets.service.ts`, `controllers/platform-support-tickets.controller.ts`

## BR-005 as a structural guarantee, not just a rule

"Support Tickets never modify Billing/CRM/Workspace entities directly" is stated as a business rule in the source document, but it's enforced structurally here, not just by convention: `SupportTicketRepository`/`SupportTicketService` have no dependency on any Billing/CRM/Workspace repository or service anywhere in their constructors. A ticket carries a plain `workspaceId` string — it references a workspace the same way an audit-log entry does, with no relationship, no cascading write, no code path that could touch another module's collection even by accident. If a future change ever needs a ticket's resolution to trigger a real action elsewhere (e.g., auto-issuing a refund for a `BILLING` ticket), that would be a new, explicit, separately-approved capability — not something this service silently grows into.

## Category taxonomy: an engineering judgment call, not a specified requirement

§4.6 names Category as a ticket field but never enumerates its values (unlike Priority, which §10 gives explicitly: LOW/MEDIUM/HIGH/CRITICAL). Rather than a free-text field — which would make later filtering/reporting by category meaningless — `SupportTicketCategory` was given a small, generic taxonomy (`BILLING`/`TECHNICAL`/`ACCOUNT`/`FEATURE_REQUEST`/`OTHER`), the same footing as Volume-1's `AnnouncementTargetType`: a real enum invented where the document left a gap, not a business rule guessed at. If a different taxonomy is wanted, it's a schema-enum change, not a design change.

## Status transitions: `CLOSED` is the only enforced terminal state

§4.6's own diagram shows a single downward path — `OPEN → IN_PROGRESS → WAITING_CUSTOMER → RESOLVED → CLOSED` — but the document doesn't say whether that's the _only_ legal path or just the common one. A strictly-linear, forward-only state machine was considered and rejected: real support workflows routinely need to move backward (a customer replies while `WAITING_CUSTOMER`, moving the ticket back to `IN_PROGRESS`; a `RESOLVED` ticket gets reopened when the same issue recurs). Enforcing the diagram as a literal one-way graph would have blocked both of those completely ordinary cases without the document ever asking for that restriction.

The resolution: only `CLOSED` is treated as genuinely terminal — `PlatformSupportTicketsService.update()` rejects any change to an already-`CLOSED` ticket, and allows every other transition freely, including backward ones. This is a deliberately light-touch validation, not a full state machine — documented here specifically so a future reader doesn't mistake the absence of stricter validation for an oversight.

## Resolution is required to resolve

Not explicitly stated in §4/§10, but resolved by the same reasoning §10's "Support Ticket: Title mandatory" already applies to ticket creation: a ticket moving to `RESOLVED` with no resolution text defeats the purpose of the field existing at all. `update()` rejects `status: RESOLVED` unless a `resolution` is supplied in the same call or was already set on the ticket from an earlier update — the check is on the _ticket's resulting state_, not strictly on the current request, so an operator can set resolution text in one call and flip to `RESOLVED` in a later one.

## What was flagged but deliberately not built

The architecture review for this volume flagged two real gaps that the Architect's approval did not ask to add: **ticket comments/an internal log** (a ticket can only carry one final `resolution` string — there's no way to record intermediate progress notes the way CRM's Activities or Communication's Conversation Notes do) and **query filters on the ticket list** were added anyway since they're a natural extension of the repository's own filter shape, not new scope. Comments were left out entirely — adding them would mean a second new collection this document never named. If ticket-level discussion history becomes a real need, that's new scope for a future volume, not something to retrofit here.
