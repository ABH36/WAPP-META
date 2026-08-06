# CRM-005 — Lead Qualification Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-2 recommendation #1)
**Implemented in:** `apps/api/src/modules/crm/{crm.constants.ts,services/lead.service.ts}`, `packages/shared-types/src/enums/lead-status.enum.ts`

## LeadStatus — 8 values, resolved 2026-08-06

`NEW | CONTACTED | QUALIFIED | PROPOSAL_SENT | NEGOTIATION | WON | LOST | UNQUALIFIED`. PRD-004 Volume-2 §8 lists 7 (everything except `UNQUALIFIED`); the pre-existing enum comment cites `BDC-015` as the reason `UNQUALIFIED` and `LOST` are deliberately distinct ("`UNQUALIFIED`: never matched qualification criteria; `LOST`: a qualified opportunity not converted"). Resolved as: Volume-2's 7 pipeline stages plus `UNQUALIFIED` preserved from `BDC-015` — Volume-2 not repeating an already-approved Business Decision isn't the same as retiring it. The stale `ASSIGNED` value (present in the enum before this Volume was relayed) was dropped — assignment is `Lead.assignedUserId` (§10), never a status.

## The complete transition matrix, resolved 2026-08-06

§7's diagram shows only two example paths. Resolved: a linear forward pipeline (`NEW→CONTACTED→QUALIFIED→PROPOSAL_SENT→NEGOTIATION→WON`, no skipping stages, no moving backward), with `LOST` reachable from any of the five non-terminal stages — a deal can die at any point, not only right after first contact. `LEAD_STATUS_TRANSITIONS` (`crm.constants.ts`) encodes this explicitly per source status, the same `allowedFrom`-list shape `CustomerService.transitionStatus()` already established.

**`UNQUALIFIED` reachability — an engineering judgment call, not a fresh business rule.** The confirmed resolution above only settled `LOST`'s reachability; Volume-2's text is silent on `UNQUALIFIED` entirely (it isn't in §7/§8 at all — it's `BDC-015`'s addition). `LEAD_STATUS_TRANSITIONS` extends `LOST`'s just-approved "reachable from any non-terminal stage" rule symmetrically to `UNQUALIFIED`, on the reasoning that both are terminal negative outcomes distinguished only by _why_ the lead didn't convert (never fit vs. fit-but-didn't-convert, per `BDC-015`'s own framing) — there's no reason one would be stage-restricted while the other isn't. Flagged here explicitly for Architecture Review rather than silently assumed.

## Every status change generates an event — BR-010, satisfied by two tiers

§17 names exactly 8 domain events, but only three (`Lead Qualified`/`Lead Won`/`Lead Lost`) map to specific status _targets_ — `CONTACTED`/`PROPOSAL_SENT`/`NEGOTIATION`/`UNQUALIFIED` have no named event of their own. BR-010 ("Lead status changes shall generate domain events") reads as a blanket requirement covering all seven possible targets, not just the three milestones. Resolved by adding one event not explicitly named in §17: `DomainEvent.LEAD_STATUS_CHANGED`, a generic fallback — the same dual-tier shape `ADR-COMM-013` already established for `CONVERSATION_ASSIGNED` (generic) vs. `CONVERSATION_SLA_BREACHED` (specific, additional).

`LeadService.updateStatus()`'s `MILESTONE_STATUS_EVENTS` map: target `QUALIFIED`/`WON`/`LOST` emit their own named event _instead of_ the generic one (matching Customer's block/activate/archive precedent — no double-emit); every other legal target (`CONTACTED`/`PROPOSAL_SENT`/`NEGOTIATION`/`UNQUALIFIED`) emits `LEAD_STATUS_CHANGED`.

## What this ADR does not do

No code changes beyond what Part-2 already implements — this documents the qualification/transition strategy Part-2 was built against. Lead Conversion (Volume-3/Part-3) reads `WON` as its trigger condition but implements the actual conversion mechanism separately (BR-009).
