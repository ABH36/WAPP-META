# Lead State Machine

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-2 (Lead Management)
**Implemented in:** `apps/api/src/modules/crm/schemas/lead.schema.ts`, `crm.constants.ts` (`LEAD_STATUS_TRANSITIONS`), `services/lead.service.ts`

## Status list

The 8 statuses are PRD-004 Volume-2 §8's 6-stage pipeline (New, Contacted, Qualified, Proposal Sent, Negotiation, Won) plus Lost, plus Unqualified (preserved from the already-approved BDC-015 — see `docs/ADR-CRM-005-lead-qualification-strategy.md` for why Volume-2 not repeating BDC-015 isn't the same as retiring it).

| Status          | Meaning                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `NEW`           | Lead just created; no engagement yet.                                            |
| `CONTACTED`     | First outreach has happened.                                                     |
| `QUALIFIED`     | Confirmed as a real opportunity matching business qualification criteria.        |
| `PROPOSAL_SENT` | A proposal/quote has been sent.                                                  |
| `NEGOTIATION`   | Actively negotiating terms.                                                      |
| `WON`           | Terminal — triggers Lead Conversion (Volume-3/Part-3, BR-009).                   |
| `LOST`          | Terminal — a qualified opportunity that didn't convert.                          |
| `UNQUALIFIED`   | Terminal — never matched qualification criteria (BDC-015, distinct from `LOST`). |

## Transition table

| From \ To                    | CONTACTED | QUALIFIED | PROPOSAL_SENT | NEGOTIATION | WON | LOST | UNQUALIFIED |
| ---------------------------- | --------- | --------- | ------------- | ----------- | --- | ---- | ----------- |
| **NEW**                      | ✅        |           |               |             |     | ✅   | ✅          |
| **CONTACTED**                |           | ✅        |               |             |     | ✅   | ✅          |
| **QUALIFIED**                |           |           | ✅            |             |     | ✅   | ✅          |
| **PROPOSAL_SENT**            |           |           |               | ✅          |     | ✅   | ✅          |
| **NEGOTIATION**              |           |           |               |             | ✅  | ✅   | ✅          |
| **WON / LOST / UNQUALIFIED** |           |           |               |             |     |      |             |

Linear forward pipeline only (no skipping stages, no moving backward); `LOST` and `UNQUALIFIED` are each reachable from any non-terminal stage — a lead can die, or turn out to have never qualified, at any point in the pipeline, not only right after first contact. `WON`/`LOST`/`UNQUALIFIED` have no outgoing transitions at all (`LEAD_STATUS_TRANSITIONS[status] === []`). Enforced by `LeadService.updateStatus()` checking `LEAD_STATUS_TRANSITIONS[lead.status].includes(newStatus)` before writing — an out-of-table transition throws `BadRequestException`, never silently no-ops.

## Archive is a separate axis, not a 9th status

`Lead.archivedAt: Date | null` is independent of `status` — a Lead can be archived from any status, including terminal ones, without that being a pipeline transition. `PATCH /crm/leads/{id}/archive` and `PATCH /crm/leads/{id}/status` are two different endpoints for exactly this reason (see `docs/ADR-CRM-006-lead-ownership-strategy.md`). Once `archivedAt` is set, no further status transition, assignment, or general edit is accepted (`BadRequestException`) — the same Editing Policy Customer already has.

## Domain events per transition

Every legal status change emits exactly one event (BR-010) — either its own named milestone event, or the generic fallback:

| Target status                                                 | Event                           |
| ------------------------------------------------------------- | ------------------------------- |
| `QUALIFIED`                                                   | `LEAD_QUALIFIED`                |
| `WON`                                                         | `LEAD_WON`                      |
| `LOST`                                                        | `LEAD_LOST`                     |
| `CONTACTED` / `PROPOSAL_SENT` / `NEGOTIATION` / `UNQUALIFIED` | `LEAD_STATUS_CHANGED` (generic) |

`LEAD_ARCHIVED` fires separately, from `archive()`, never from `updateStatus()`.

## What this document does not cover

- _Why_ each of these decisions was made (the transition matrix's full-lattice-except-backward shape, the milestone/generic event split, the archive-as-separate-axis choice) — see `docs/ADR-CRM-005-lead-qualification-strategy.md` and `docs/ADR-CRM-006-lead-ownership-strategy.md` for the reasoning; this document is the canonical state reference only.
- Lead Conversion's own mechanics once `WON` is reached — PRD-004 Volume-3/Part-3, BR-009.
