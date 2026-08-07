# Usage Enforcement Evolution

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-3 — the long-term strategy for integrating the Usage engine into existing and future business modules, consolidated into one reference document per Architecture Review recommendation
**Implemented in:** `apps/api/src/modules/billing/services/usage.service.ts` (the engine this document is the integration strategy for — no new code accompanies this ADR)

This document is the single authoritative reference for how CRM, Communication, and Workspace/Team should eventually call into the Usage engine built in Volume-3 — consolidating the "engine only, retrofit deferred" resolution from `docs/ADR-BILL-008-commercial-enforcement-strategy.md` into a forward-looking integration plan. See TD-015 (`docs/TECH-DEBT.md`) for the tracked, not-yet-scheduled work this describes.

## The shape of a retrofit

Every future retrofit is the same three-part change, regardless of which module or resource:

1. **Import `BillingModule`** into the retrofitted module (`CrmModule`, `CommunicationModule`, `WorkspaceModule`) and inject `UsageService` — a new dependency direction none of those modules have needed before, but still one-directional (business module → Billing), matching every existing Billing dependency in this codebase (never the reverse).
2. **Call `checkLimit`/`checkFeatureEnabled` before the write**, inside the business module's own service method (e.g. `CustomerService.create()`), and reject (`ForbiddenException`/`BadRequestException`, matching that module's existing error conventions) if not allowed. This is a pre-flight check with no side effect — it does not touch `WorkspaceUsage` itself.
3. **Change nothing about counting.** `UsageCounterListener` already increments the counter reactively, after the resource is actually persisted, via the same domain event the retrofit's own service method already emits today. A retrofit must never call `UsageService.recordCreation()` directly — that stays owned exclusively by the event listener, so there is exactly one way a counter ever changes. Adding a pre-flight check does not change what "consumption" means or when it's recorded.

## Declarative vs. imperative — a per-call-site choice, not a platform mandate

A simple, one-counter-per-resource check (e.g. "does this Workspace have room for one more Customer") could reasonably be a decorator-driven guard, the same shape `PermissionsGuard`/`@RequirePermission` already establishes. A composite check (e.g. sending a Broadcast to N contacts consumes N Messages, not 1) needs the actual N before it can evaluate, and only the service method computing the recipient list has that number — this has to be an inline, imperative call inside the service, not a route-level guard. This document deliberately does not mandate one pattern platform-wide; each retrofit picks whichever fits the resource it's gating, consistent with how this codebase already lets CRM's Activity ownership checks stay inline (`docs/ADR-CRM-016-activity-ownership-strategy.md`) while most other authorization stays guard-based.

## Fail-closed by default

If `UsageService.checkLimit`/`checkFeatureEnabled` itself errors (a database issue, an unexpected exception), the retrofitted call site should treat that as "deny," not "allow" — the same fail-closed posture `PermissionsGuard` already has for a missing role. A future retrofit that lets a Usage-check failure silently permit unlimited creation would defeat the entire purpose of the engine. This is a default recommendation, not a hard requirement for every resource — a lower-stakes counter might reasonably choose to fail open with a logged warning instead, but that should be an explicit, documented choice at retrofit time, not an accident of how errors happen to propagate.

## This work is gated by TD-014, not just TD-015

Retrofitting enforcement into CRM/Communication only matters once there's something real to enforce — every seeded Plan's limits are still `null` (TD-014, pending commercial approval). Wiring `checkLimit` into a dozen call sites today would compile and pass tests, but every check would trivially return `allowed: true` forever, since a `null` limit is never exceeded. The two Tech Debt items are coupled: TD-014's resolution (real limits approved) is a natural, though not strictly required, trigger for prioritizing TD-015's retrofit work — doing the retrofit first isn't wrong, it just has no observable effect until TD-014 closes.
