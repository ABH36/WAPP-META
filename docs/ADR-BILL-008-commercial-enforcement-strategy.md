# Commercial Enforcement Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-3 §3/§4/§7/§12/§15 — the runtime licensing and enforcement flow for future modules
**Implemented in:** `apps/api/src/modules/billing/services/usage.service.ts`, `apps/api/src/modules/billing/listeners/plan-change-usage.listener.ts`

## This volume builds the engine, not the gates

§4's philosophy ("Business modules shall never bypass Usage enforcement") describes a target end-state, not this volume's own scope. Resolved 2026-08-07, Architecture Review: Volume-3 builds Usage's own internals (entitlements, counters, evaluation, the 4 GET endpoints) and the reusable check methods (`UsageService.checkLimit`, `checkFeatureEnabled`) — retrofitting CRM/Communication's already-frozen mutation paths to actually call them is separate, individually-approved future work, the same frozen-module discipline already applied to TD-007. `BillingModule` exports `UsageService` specifically so that future work can inject it directly (§15 — "Business modules may only query Usage") once approved; nothing in this codebase calls `checkLimit`/`checkFeatureEnabled` yet.

## Real observability today, even without real gates

Because `UsageCounterListener` is wired to real domain events regardless of enforcement retrofitting, Usage can fully detect and announce a Workspace crossing a warning threshold, exceeding a limit, or becoming locked — via `USAGE_THRESHOLD_REACHED`/`USAGE_LIMIT_EXCEEDED`/`WORKSPACE_LOCKED` — even though nothing yet stops the request that caused it. This is a deliberate, useful intermediate state: Volume-3 ships full visibility now, with the actual blocking behavior arriving whenever the retrofit work lands.

## Locking is per-counter, never Workspace-wide

Resolved 2026-08-07, Architecture Review: "Workspace Locked" (§12) means new-resource-creation is blocked for the specific over-limit resource type (e.g. Customer creation), not a platform-wide state. It never touches the canonical `WorkspaceStatus` enum (BR-002) — existing data stays fully readable and login is entirely unaffected, distinguishing it clearly from `WorkspaceStatus.SUSPENDED` (reserved for fraud/abuse, blocks login itself). `WorkspaceLockedPayload`/`WorkspaceUnlockedPayload` carry `counterType` for exactly this reason — a listener reacting to these events knows which capability is affected, not that the whole Workspace stopped working.

## Plan-change diffing is symmetric, not upgrade-only

`UsageService.handlePlanChange()` listens to `SUBSCRIPTION_UPGRADED` — the same single hook point `InvoiceGenerationListener` (Volume-2) uses, since it fires unconditionally on every immediate plan change. The diff itself is symmetric in both directions (entitlement/limit newly granted _or_ newly revoked, lock newly cleared _or_ newly applied) rather than assuming "upgrade" always means "more generous plan": `SubscriptionService.upgrade()` (Volume-1) is used for any immediate plan change regardless of price/tier direction, so the same call could in principle move a Workspace to a _more_ restrictive Plan.

There is no hook for a queued downgrade actually being applied at `renewalDate` — `SubscriptionService.applyDuePendingDowngrades()` (Volume-1) doesn't emit an event to listen for. That gap is left open deliberately rather than modifying frozen Volume-1 code to add one; a Workspace whose downgrade silently applies at renewal won't get a `WORKSPACE_LOCKED`/`FEATURE_DISABLED` notification until the next event that happens to touch Usage's evaluation path.

## Reject-only-once-exceeded, not reject-at-the-limit

§8 resolved 2026-08-07: a Workspace may sit exactly at its limit (100 of 100 Customers is allowed); the request that would push it _past_ the limit is the one that gets rejected/flagged. 100% usage itself is the last warning threshold, not yet an exceeded state — `recordCreation()`'s `count > limit` check (strictly greater than) is the literal implementation of this resolution.
