# COMM-015 — Escalation Hierarchy Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-06
**Raised by:** Architecture Review (Phase-4 Part-4c recommendation #2)

## Purpose

Part 4c shipped exactly one escalation tier: an SLA-breached Conversation reassigns once, to a Manager, and that's the end of the path — there is no follow-up if the Manager also fails to respond. The Architect's review named a four-tier hierarchy: Agent → Manager → Owner → Platform-Level Alerts. This ADR fixes what a real hierarchy would require structurally, so it isn't built as an ad-hoc extension of today's single-tier `EscalationService`.

## Today's model, restated as a baseline

An unanswered Conversation starts with whoever it's assigned to (an Agent, via Auto Assignment — or nobody, if Auto Assignment is off or found no eligible Agent). One SLA breach escalates it to a Manager, once. `Conversation.lastEscalatedAt` records _that an_ escalation happened and gates re-escalation (another full `SLA_RESPONSE_HOURS` window must pass) — it does not record _which tier_ was reached. That single fact is the core structural gap every tier beyond Manager runs into.

## What a real hierarchy needs that doesn't exist yet

**A tier concept.** `lastEscalatedAt` alone can't answer "was this already escalated to a Manager, and now needs to go to the Owner?" — it only answers "was this escalated recently at all." A multi-tier hierarchy needs either an `escalationTier` field (e.g. `NONE | MANAGER | OWNER | PLATFORM`) or a small history of escalation events per Conversation (which the current model, one mutable timestamp, isn't shaped for). This is the one piece every tier below actually depends on — nothing further down this list is buildable before it exists.

**A second (or Nth) threshold.** "Escalate to Owner if the Manager also doesn't respond" needs its own elapsed-time question — time since the Manager-tier escalation, not time since the customer's last message (which `SLA_RESPONSE_HOURS`/`findSlaBreachCandidates` already measures for the first tier). Reusing the exact same cutoff for a second tier would either escalate too eagerly (measuring from the original customer message, already "spent" reaching Manager) or need a distinct clock per tier.

## The tiers themselves

### Agent

Not a new escalation tier — this is where a Conversation already starts (via Auto Assignment, Part 4b) before any breach has happened. Listed by the Architect for completeness of the hierarchy, not as new scope.

### Manager

Already built (Part 4c) — the one tier that exists today.

### Owner

**What it would mean:** if the Manager tier's own response-time SLA also lapses, escalate again — to the workspace `OWNER` specifically (a single, well-known role, not a pool to pick "least active" from — there is exactly one Owner per workspace).

**What doesn't exist yet:** the tier concept above, plus a second threshold. Structurally the smallest addition beyond what Part 4c already has — reuses the same `EscalationService`/`ConversationRepository.assign()` reuse pattern, just against a different, single-member "pool."

### Platform-Level Alerts

**What it would mean:** if even the Owner doesn't respond, notify WAPP's own platform-side support/operations staff (`PlatformRole` — `PLATFORM_SUPER_ADMIN`/`PLATFORM_SUPPORT_MANAGER`/`PLATFORM_SUPPORT_EXECUTIVE`, `packages/shared-types/src/enums/role.enum.ts`) rather than anyone inside the tenant workspace.

**What doesn't exist yet — and this is a materially bigger step than Owner:** `PlatformRole` is a wholly separate organizational layer from `TenantRole` (ADR-032 — "Platform" prefix is mandatory precisely because these are different roles at different layers, never to be conflated). Every piece of this codebase's Communication module today is workspace-scoped (`workspaceId` on every query, every repository method) — there is no existing query surface, permission gate, or even a notion of "the Platform staff assigned to workspace X" to reassign _to_, because Conversations aren't owned by or visible to Platform roles at all today. This is not a Manager→Owner-shaped extension; it's a new cross-cutting concern closer in shape to the Global Audit/Notification modules SDP-001 already defers (`domain-events.ts`'s own framing) than to anything `EscalationService` currently does. Likely the right shape for this tier, when built, is: `EscalationService` emits a domain event (reusing the `CONVERSATION_SLA_BREACHED` pattern, or a new `PLATFORM_ESCALATION_TRIGGERED`) that a future Platform-side alerting system subscribes to — not a direct reassignment `EscalationService` performs itself.

## What this means going forward

Owner-tier escalation is a real, contained next step once the tier concept exists — no new infrastructure, same reuse pattern as Manager-tier today. Platform-Level Alerts is not: it depends on Platform/Tenant boundary work this ADR is not scoping, and should be designed as an event-driven handoff to a future Platform module, not an in-module reassignment.

## What this ADR does not do

No code changes, no `escalationTier` field, no Owner-tier threshold, no Platform event. It exists so a future PR proposing hierarchy work starts from an agreed structural gap (the missing tier concept) and an agreed line (Owner is an `EscalationService` extension; Platform is a different module's problem) instead of re-deriving both from scratch.
