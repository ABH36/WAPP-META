# Compliance Decision Log Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this document)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-3a recommendation #2)

## Current state

`ComplianceEngineService.assertFreeTextAllowed()` (`docs/COMM-COMPLIANCE-ENGINE.md`) either does nothing (send proceeds) or throws `OutsideCustomerServiceWindowException`, which the global exception filter turns into an HTTP `403`. **Nothing is recorded when a send is blocked** — the only trace is a client-side error response and, if request logging happens to capture it, an HTTP access log line. There's no structured, queryable record of "this workspace's agents have hit the compliance wall N times this week" or "which conversations are most often blocked."

## Why this matters

Three real needs this gap blocks, all named in the recommendation:

- **Support**: "why couldn't I message this customer?" is currently answerable only by reasoning about `Conversation.lastCustomerMessageAt` after the fact — there's no direct record of the denial itself.
- **Analytics**: Compliance-block frequency is a real signal (e.g., a workspace hitting it constantly might need better proactive customer engagement, or more template coverage for common scenarios) — invisible today.
- **Auditing**: A blocked send is a compliance-relevant event (proof the system enforced Meta's rule) — the kind of thing `docs/ADR-EVENTS-001`'s domain-event pattern exists to eventually feed into Global Audit (PRD-007).

## Decision — extend the existing domain-event pattern, don't invent a new mechanism

This project already has exactly the right tool for this: the domain-event catalog (`apps/api/src/common/events/domain-events.ts`) plus the temporary `DomainEventLoggerListener` standing in for Audit/Notification until those modules exist (`docs/ADR-EVENTS-001`). A Compliance Decision Log should be one more event on that same catalog, not a bespoke logging table or a new pub/sub mechanism.

**Proposed event:** `DomainEvent.COMPLIANCE_DECISION_RECORDED` (`"communication.compliance_decision_recorded"`), emitted by `ComplianceEngineService` on **every** evaluation — both `ALLOWED` and `BLOCKED` outcomes, not just denials, so analytics can compute a real block-rate (blocked ÷ total evaluated), not just a raw count with no denominator.

**Proposed payload**, matching the six fields the recommendation named exactly:

```ts
interface ComplianceDecisionRecordedPayload extends BaseEventPayload {
  conversationId: string | null; // null covers "no Conversation exists yet" — still a real decision
  userId: string; // the acting agent (or "SYSTEM" for a future automated sender, e.g. Broadcast)
  workspaceId: string; // already part of BaseEventPayload — listed for completeness against the request
  rule: "CUSTOMER_SERVICE_WINDOW"; // an enum, not a free string — Part 3b's Broadcast/Campaign rules (audience consent, opt-out) will add values here
  decision: "ALLOWED" | "BLOCKED";
  occurredAt: string; // already part of BaseEventPayload
}
```

## Why not implement this now

Emitting this event today would mean every `assertFreeTextAllowed()` call fires an event with no consumer beyond the temporary logger — the same "publish before a real subscriber exists" pattern already used everywhere else in Communication, so it wouldn't be _wrong_ to build now. It's deferred anyway because: (a) the Architect's own framing marks this documentation-only, (b) a real "Compliance Decision Log" _query_ surface (list/filter past decisions) needs a persisted, indexed collection, not just an ephemeral event — and that's a bigger, separate piece of work than adding one more `eventEmitter.emit()` call, best scoped and built together rather than half now/half later.

## What building this later looks like

1. Add `COMPLIANCE_DECISION_RECORDED` to the domain-event catalog with the payload above.
2. `ComplianceEngineService.assertFreeTextAllowed()` (and, once Part 3b exists, whatever compliance check gates Broadcast/Campaign sends) emits it on every evaluation.
3. A persisted `ComplianceDecision` collection (or, once Global Audit exists per PRD-007, that module absorbing this event like every other auditable event) for the actual query/reporting surface support and analytics need.
