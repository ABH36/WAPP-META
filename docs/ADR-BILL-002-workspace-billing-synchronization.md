# Workspace Billing Synchronization

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-1 — how Subscription lifecycle transitions keep Workspace.status correct, while Workspace remains the single runtime access-control authority
**Implemented in:** `apps/api/src/modules/billing/services/subscription.service.ts`

## Two status enums, one authority

`WorkspaceStatus` (`TRIAL/ACTIVE/EXPIRED/SUSPENDED/CANCELLED`) carries its own doc comment declaring it canonical — "do not re-derive elsewhere" — and already has live consumers (`READ_ONLY_WORKSPACE_STATUSES`/`LOGIN_BLOCKED_WORKSPACE_STATUSES`, e.g. Lead Conversion's workspace-active precondition). Volume-1's own Subscription lifecycle (§4) needed a richer set, including `GRACE_PERIOD`, which `WorkspaceStatus` has no equivalent for. Resolved during Architecture Review: `SubscriptionStatus` is its own, separate enum (`TRIAL/ACTIVE/GRACE_PERIOD/SUSPENDED/CANCELLED`) — `WorkspaceStatus` itself is never extended or modified. `Workspace.status` remains the one thing every access-control check in this codebase (present and future) reads; `Subscription.status` is Billing's own, richer internal lifecycle, never read by any other module for access-control purposes.

## The mapping

Every `SubscriptionService` method that changes `Subscription.status` also calls `WorkspaceRepository.updateStatus()` synchronously, in the same method, before emitting any domain event — the same "direct call now, event afterward for other listeners" shape `LeadConversionService` already established for `CustomerRepository`. `Workspace.status` is access-control-critical (it gates login and mutation across the whole platform); it needs to be correct the moment a Subscription transition happens, not eventually-consistent via a second listener that might lag or fail independently.

| Subscription transition                             | Workspace.status becomes                      |
| --------------------------------------------------- | --------------------------------------------- |
| Created (TRIAL)                                     | `TRIAL`                                       |
| Upgraded from TRIAL/GRACE_PERIOD/SUSPENDED → ACTIVE | `ACTIVE`                                      |
| Trial or paid-period lapse → GRACE_PERIOD           | `EXPIRED`                                     |
| Grace Period expiry, still unpaid → SUSPENDED       | `EXPIRED` _(not `WorkspaceStatus.SUSPENDED`)_ |
| Cancelled                                           | `CANCELLED`                                   |

The `SUSPENDED`→`EXPIRED` row is the one non-obvious mapping, and it's deliberate: `WorkspaceStatus.SUSPENDED`'s own doc comment reserves it specifically for fraud/policy-violation/chargeback/abuse (per PRD-007 Vol 3 §D) — a harder block than `EXPIRED` (login itself is blocked, not just mutation). Ordinary non-payment, even after a full Grace Period lapses, is not that — the customer did nothing wrong, they just haven't paid. Mapping non-payment `SUSPENDED` to `WorkspaceStatus.EXPIRED` keeps that reserved, harsher status meaning exactly one thing platform-wide, and keeps a non-paying Workspace's owner able to log in and pay (`EXPIRED` allows login; `SUSPENDED` doesn't) — which a hard login lockout would actively prevent.

## Trial expiry and paid-period lapse are the same sweep, on purpose

§4's lifecycle diagram is linear (`TRIAL → ACTIVE → GRACE_PERIOD → SUSPENDED → CANCELLED`), but — resolved the same way this project already resolved the identical shape of question for `LeadStatus` (`docs/ADR-CRM-005-lead-qualification-strategy.md`) and `DealStage` (`docs/ADR-CRM-012-deal-lifecycle-strategy.md`) — that diagram is the maximal path, not a mandatory one. A Subscription that never converts out of `TRIAL` still needs to reach `GRACE_PERIOD` on its own, without ever passing through `ACTIVE`. `SubscriptionService.expireLapsedTrialsAndActiveSubscriptions()` treats both cases identically: a `TRIAL` past `trialEndsAt`, or an `ACTIVE` subscription past `renewalDate`, both move to `GRACE_PERIOD` the same way. This is also a direct, minimal consequence of Volume-1 having no Payments module yet (§3/§17) — there is no way to confirm a renewal charge actually succeeded, so an `ACTIVE` subscription reaching its `renewalDate` is treated exactly like a trial that was never converted: no confirmed payment, so the grace clock starts.

## The lifecycle sweep is real, new infrastructure — not a byproduct

`SUBSCRIPTION_LIFECYCLE_SWEEP_INTERVAL_MS` runs an hourly BullMQ job (`SubscriptionLifecycleProcessor`, same repeatable-job-registered-idempotently-on-boot shape as `ConversationAutoCloseProcessor`/`SlaEscalationProcessor`) that, per pass: applies any downgrade whose `renewalDate` has arrived, then moves lapsed Trials/Active subscriptions into `GRACE_PERIOD`, then suspends Grace Periods past `graceEndsAt`. This was resolved as in-scope for Volume-1 itself (§2/§3 explicitly assign Subscription "Trial lifecycle" and "Determine Workspace commercial status" ownership) rather than deferred — before this Part, `trialEndsAt` was set once at Workspace creation and nothing anywhere ever checked it again.
