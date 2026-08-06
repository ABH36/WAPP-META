# COMM-014 — SLA Policy Evolution

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-06
**Raised by:** Architecture Review (Phase-4 Part-4c recommendation #1)

## Purpose

Part 4c shipped exactly one SLA policy: a flat, platform-wide response-time threshold (`SLA_RESPONSE_HOURS`, `docs/COMM-SLA-ESCALATION.md`). The Architect's review named four directions this could grow: Resolution SLA, Business Hours Aware SLA, Priority Based SLA, Customer Tier SLA. This ADR fixes what each would mean relative to what already exists, so a future implementation starts from an agreed problem statement.

## Today's policy, restated as a baseline

**Response SLA** — breached when the customer's last message is still the most recent message overall (no reply yet) and that wait exceeds `SLA_RESPONSE_HOURS` (flat 4 hours, wall-clock, platform-wide, not per-workspace). Every future direction below is a variation on this one axis (what counts as breach) or a new orthogonal axis (who/what the threshold varies by) — evaluated against that baseline.

## Future directions

### Resolution SLA

**What it would mean:** a second, independent SLA measuring total elapsed time from Conversation creation (or reopening) until it reaches `RESOLVED`, regardless of how many replies happened along the way — a different question from "did we respond in time" (Response SLA already answers that).

**What doesn't exist yet:** nothing structural — `Conversation.createdAt` and `resolvedAt` already exist and already capture exactly the two timestamps this needs. This is the closest of the four to buildable today: a second sweep query (or a second branch in the existing one) comparing `resolvedAt ?? now` against `createdAt`, with its own threshold constant and its own breach event (or a `slaType` field added to `ConversationSlaBreachedPayload` if reusing the existing event). No new domain data required.

### Business Hours Aware SLA

**What it would mean:** measure elapsed _business_ time (skipping closed hours/days/holidays) rather than flat wall-clock time — already named as the accepted gap in TD-005 (`docs/TECH-DEBT.md`), not a new item this ADR introduces.

**What doesn't exist yet:** `business-hours.util.ts` only answers "is this one instant open or closed" (`isWithinBusinessHours`), not "how much open time elapsed between two instants." This applies equally to whichever SLA type (Response or Resolution) it's layered onto — it's an orthogonal axis (how time is measured), not a new SLA type of its own.

### Priority Based SLA

**What it would mean:** different thresholds for different Conversations based on an assigned priority (e.g. Urgent gets a 1-hour threshold, Normal gets 4 hours).

**What doesn't exist yet:** there is no priority/severity concept on `Conversation` at all. This needs a new field, a decision on who sets it (agent-assigned at triage? inferred from message content/keywords? inherited from a Template category?), and a decision on whether it's a Business Decision (customer-facing feature) or an internal triage tool — that framing question is bigger than this ADR should resolve.

### Customer Tier SLA

**What it would mean:** different thresholds based on the customer's account tier (e.g. Enterprise gets a 1-hour threshold, Standard gets 4 hours).

**What doesn't exist yet:** this runs into the same wall Campaign's audience model already named (`docs/COMM-CAMPAIGN-LIFECYCLE.md`, `docs/COMM-BROADCAST-LIFECYCLE.md`) — there is no CRM entity, no Customer/Contact tier or segmentation field, anywhere in this codebase (Phase 5 scope). Customer Tier SLA cannot be built before that CRM foundation exists; it isn't a Communication-module-only change.

## What this means going forward

Resolution SLA and Business Hours Aware SLA are both buildable as extensions of today's model with no new cross-module dependency — Resolution SLA needs no new data at all, Business Hours Aware SLA needs one new pure function alongside the existing `isWithinBusinessHours`. Priority Based SLA needs a new Business Decision before an engineering change. Customer Tier SLA is blocked entirely on CRM (Phase 5) and shouldn't be attempted before then.

## What this ADR does not do

No code changes, no new constants, no new event fields. It exists so a future PR proposing one of these directions starts from an agreed scope (what data is missing, whether it's a Business Decision) instead of re-deriving that scoping from scratch — the same purpose ADR-COMM-012 already serves for Assignment Strategy.
