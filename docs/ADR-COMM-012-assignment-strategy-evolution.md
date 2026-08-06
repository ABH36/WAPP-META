# COMM-012 — Assignment Strategy Evolution

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-06
**Raised by:** Architecture Review (Phase-4 Part-4b recommendation #1)

## Purpose

Part 4b shipped two assignment strategies (Round Robin, Least Active Agent) behind one `AssignmentStrategy` enum on `AutomationSettings`. The Architect's review named three future strategies without committing to their design yet: Skill Based, Load Based, and AI Assisted. This ADR fixes what each would actually mean relative to what already exists, and — more importantly — what each would require that doesn't exist today, so none of them get built as a surprise cross-module expansion later.

## Today's two strategies, restated as a baseline

- **Round Robin** — cycles through the eligible pool in a fixed, stable order, no signal about the agent or the Conversation beyond "who's eligible" and "who went last."
- **Least Active Agent** — reads one signal (`ConversationRepository.countActiveAssignedToUser`) and picks the minimum. Still agent-state-only, no Conversation-content signal at all.

Both share the same eligibility gate (`AUTO_ASSIGNMENT_ELIGIBLE_ROLES`, `docs/COMM-AUTO-ASSIGNMENT.md`) and the same trigger (unassigned Conversation, inbound message). Every future strategy below is evaluated against that same shape — same eligibility gate, same trigger — unless stated otherwise.

## Future strategies

### Skill Based Assignment

**What it would mean:** route based on a match between the Conversation's needed skill (language, product area, etc.) and an agent's declared skill set — not just role membership.

**What doesn't exist yet, and would have to:** there is no skill/tag concept on `User` at all, and no skill/tag concept on `Conversation` (or its `Contact`/`Message`) to match against. This isn't a query-method gap like Least Active Agent's `countActiveAssignedToUser` was — it's two new pieces of domain data (agent skills, Conversation-required-skill) that don't have an obvious source yet (self-declared by the agent? assigned by a Manager? inferred from the inbound message's language/content?). That inference question alone is bigger than this ADR should resolve — it needs its own Business Decision before implementation starts.

### Load Based Assignment

**What it would mean:** distinct from Least Active Agent's raw Conversation _count_ — weight by actual workload (e.g. message volume, average response time per open Conversation, or a configurable per-agent capacity limit), not just "how many Conversations."

**What doesn't exist yet:** a workload _signal_ beyond count. `countActiveAssignedToUser` is a count; a real load metric needs either a capacity concept on `User`/workspace membership (a max-concurrent-Conversations setting) or a computed weight (recent message volume per Conversation). The simplest version of this is "Least Active Agent with a per-agent capacity cap instead of unbounded eligibility" — worth building as an extension of the existing strategy rather than a wholly new one, if and when this is picked up.

### AI Assisted Assignment

**What it would mean:** a model-driven pick — e.g. predicting which agent is likeliest to resolve this specific Conversation fastest/best, rather than a deterministic rule.

**What doesn't exist yet:** no AI/ML infrastructure of any kind exists in this codebase today (no model-serving integration, no feature store, no training data pipeline). This is not a small extension of `AutoAssignmentService` — it is a new infrastructure capability the rest of the platform doesn't have a precedent for. Any future work here should start as its own Architecture proposal, not an incremental PR against `AutoAssignmentService`.

## What this means for `AssignmentStrategy`'s shape going forward

The enum (`NONE | ROUND_ROBIN | LEAST_ACTIVE`, `automation-settings.schema.ts`) can grow additional values as each strategy above is actually built, but **Skill Based and AI Assisted both need new domain data or infrastructure before they can be enum values that mean anything** — adding them to the enum ahead of that would create a selectable setting with no real behavior behind it. Load Based is the closest to buildable today, as a capacity-aware variant of Least Active Agent.

## What this ADR does not do

No code changes, no new enum values, no new schema fields. It exists so a future PR proposing one of these strategies starts from an agreed problem statement (what data is missing, whether it's a Business Decision or an engineering-only change) instead of re-deriving that scoping from scratch.
