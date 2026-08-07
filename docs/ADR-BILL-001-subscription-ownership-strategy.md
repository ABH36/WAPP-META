# Subscription Ownership Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-1 (Subscription & Plans) — the ownership boundary between Workspace and Subscription
**Implemented in:** `apps/api/src/modules/billing/`, `apps/api/src/modules/workspace/schemas/workspace.schema.ts`

## Subscription becomes sole owner of trial tracking

Before this Part, `Workspace` fully implemented §7's trial rule itself: `Workspace.status` defaulted to `TRIAL` and `Workspace.trialEndsAt` was computed and set at creation time in `WorkspaceService.create()` (14 days, D007), with no Subscription entity involved anywhere. Resolved during Architecture Review: Subscription becomes the sole owner. `Workspace.trialEndsAt` is removed from the schema entirely (`WorkspaceRepository.create()` no longer accepts it, `WorkspaceProfile`/the API response no longer exposes it); `WorkspaceService.create()` no longer computes a trial end date at all. `Subscription.trialEndsAt` is now the only place this date lives.

No real API consumer existed to break — `apps/web`/`apps/admin` are unstarted Next.js scaffolds with no source code referencing `trialEndsAt` — so this was a clean removal, not a versioned deprecation.

## A one-directional dependency: Billing depends on Workspace, never the reverse

Every dependency in this codebase so far has flowed from business modules toward platform modules — CRM imports Identity/Workspace/Communication, never the other way around. Making `WorkspaceService.create()` call directly into a Billing service to create the trial Subscription would invert that layering (a platform module depending on a business module). Resolved instead: `WorkspaceService.create()` is unchanged except for no longer computing `trialEndsAt` — it still emits `WORKSPACE_CREATED` exactly as before. `BillingModule`'s new `WorkspaceCreatedListener` subscribes to that event and calls `SubscriptionService.createTrialForWorkspace()` reactively. `WorkspaceModule` never imports `BillingModule`; `BillingModule` imports `WorkspaceModule` (for `WorkspaceRepository`, to synchronize `Workspace.status` — see `docs/ADR-BILL-002-workspace-billing-synchronization.md`).

This isn't wrapped in the same Mongo transaction as Workspace creation — `EventEmitter2`'s default synchronous, in-process emission means the listener runs (and the trial Subscription exists) by the time `this.eventEmitter.emit(WORKSPACE_CREATED, ...)` returns in the common case, but a Subscription-creation failure after a successful Workspace creation isn't rolled back together. This is consistent with how every other `WORKSPACE_CREATED` consequence in this codebase already works (no other listener is transactionally coupled to Workspace creation either) — not a new risk introduced here, and not worth a multi-document transaction (Lead Conversion's own transaction exists for a materially higher-stakes, multi-write operation) for what is, worst case, a single missing Subscription document that boot-time/support tooling can detect and repair.

## Plan is the first platform-global collection in this codebase

Every other schema so far (`Customer`, `Lead`, `Deal`, `Activity`, `Workspace` itself) is workspace-scoped. `Plan` is not — every Workspace chooses from the same shared catalog, so it carries no `workspaceId` at all. `PlanService` seeds the three names already approved at the planning stage (Starter/Growth/Enterprise) idempotently on every boot (`OnModuleInit`, upsert-by-name — the same "safe to re-run" shape `ConversationAutoCloseProcessor` already established for its own repeatable-job registration), rather than via a one-off migration script.

`Plan.billingCycle` is kept as a field even though `Plan` already stores both `monthlyPrice` and `yearlyPrice` independently (making a single "this plan's cycle" value somewhat redundant on its face) — §5 lists it explicitly, and dropping a relayed field silently, rather than including it with a documented, low-stakes interpretation, isn't this engagement's practice.

## GTM pricing is not yet approved — TD-009

`Plan.monthlyPrice`/`Plan.yearlyPrice` are nullable, not defaulted to `0`. Resolved explicitly (2026-08-07): `0` reads as "free plan" — a real, distinct commercial meaning — so it would have been persisting an unapproved business value under the guise of a placeholder. The three tiers are seeded with real names and null pricing; `§15`'s API surface has no Plan-mutation endpoint at all (`GET /billing/plans` is read-only), so setting real prices once GTM pricing is approved is a direct-DB or seed-script update, not an API/schema change. Tracked as **TD-009** in `docs/TECH-DEBT.md`.
