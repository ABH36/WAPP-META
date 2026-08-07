# Subscription Lifecycle State Machine

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-1 — the canonical Subscription state machine, consolidated into one reference document per Architecture Review recommendation
**Implemented in:** `apps/api/src/modules/billing/services/subscription.service.ts`, `apps/api/src/modules/billing/repositories/subscription.repository.ts`

This document is the single authoritative reference for `Subscription.status` transitions, Workspace synchronization, and domain events — consolidating reasoning already established in `docs/ADR-BILL-001-subscription-ownership-strategy.md` and `docs/ADR-BILL-002-workspace-billing-synchronization.md` into one place future volumes (Usage & Limits, Billing Reports) can cite without re-deriving.

## The states

`SubscriptionStatus`: `TRIAL`, `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED`, `CANCELLED`. `CANCELLED` is the only terminal state (`TERMINAL_SUBSCRIPTION_STATUSES`) — every other state has at least one legal outbound transition.

## Transition table

| From                                              | To                               | Trigger                                                                                | Who/what drives it                                                                                                                                                                           |
| ------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_                                          | `TRIAL`                          | Workspace created                                                                      | `WorkspaceCreatedListener` → `createTrialForWorkspace`                                                                                                                                       |
| `TRIAL`                                           | `ACTIVE`                         | Owner/Administrator upgrades                                                           | `POST /billing/subscription/upgrade` — this is §7's "Trial converts into Active only through Billing completion"; there is no separate conversion action                                     |
| `TRIAL`                                           | `GRACE_PERIOD`                   | `trialEndsAt` passes with no upgrade                                                   | Lifecycle sweep, `expireLapsedTrialsAndActiveSubscriptions`                                                                                                                                  |
| `ACTIVE`                                          | `ACTIVE` (plan changes)          | Owner/Administrator upgrades to a different plan                                       | `POST /billing/subscription/upgrade` — immediate, no status change                                                                                                                           |
| `ACTIVE`                                          | `GRACE_PERIOD`                   | `renewalDate` passes with no confirmed renewal (no Payments module yet to confirm one) | Lifecycle sweep, same method as the Trial case                                                                                                                                               |
| `GRACE_PERIOD`                                    | `ACTIVE`                         | Owner/Administrator upgrades during grace                                              | `POST /billing/subscription/upgrade` — grace is not a dead end                                                                                                                               |
| `GRACE_PERIOD`                                    | `SUSPENDED`                      | `graceEndsAt` passes, still unpaid                                                     | Lifecycle sweep, `suspendExpiredGracePeriods`                                                                                                                                                |
| `SUSPENDED`                                       | `ACTIVE`                         | Owner/Administrator upgrades                                                           | `POST /billing/subscription/upgrade` — Suspended is recoverable, not terminal                                                                                                                |
| `TRIAL` / `ACTIVE` / `GRACE_PERIOD` / `SUSPENDED` | `CANCELLED`                      | Owner/Administrator cancels                                                            | `POST /billing/subscription/cancel`, any time, from any non-terminal state (BR-003: preserved as a historical record, never deleted)                                                         |
| _(any status)_                                    | _(same status, `planId` queued)_ | Owner/Administrator downgrades                                                         | `POST /billing/subscription/downgrade` — does not change `status` at all; sets `pendingPlanId`, applied later by the sweep at `renewalDate` regardless of what `status` does in the meantime |

`ensureUpgradeDowngradeEligible` restricts Upgrade/Downgrade requests to `TRIAL`/`ACTIVE` only at the API layer today — the table above reflects the full state machine as designed (including recovery from `GRACE_PERIOD`/`SUSPENDED`), not the currently-narrower set the controller accepts. Widening that gate to also accept `GRACE_PERIOD`/`SUSPENDED` upgrade requests is a small, low-risk follow-up once there's a concrete need for a suspended Workspace's owner to self-serve reactivate, rather than something to guess into Volume-1's shipped API surface without a stated requirement for it.

## Workspace.status synchronization

| Subscription status       | Workspace.status                                                        |
| ------------------------- | ----------------------------------------------------------------------- |
| `TRIAL`                   | `TRIAL`                                                                 |
| `ACTIVE`                  | `ACTIVE`                                                                |
| `GRACE_PERIOD`            | `EXPIRED`                                                               |
| `SUSPENDED` (non-payment) | `EXPIRED` — never `WorkspaceStatus.SUSPENDED`, reserved for fraud/abuse |
| `CANCELLED`               | `CANCELLED`                                                             |

Full reasoning in `docs/ADR-BILL-002-workspace-billing-synchronization.md`.

## Domain events

| Event                     | Fires on                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUBSCRIPTION_CREATED`    | Subscription creation (Workspace creation)                                                                                                   |
| `TRIAL_STARTED`           | Subscription creation (always paired with `SUBSCRIPTION_CREATED`)                                                                            |
| `TRIAL_EXPIRED`           | `TRIAL` → `GRACE_PERIOD` specifically (not fired for the `ACTIVE` → `GRACE_PERIOD` case)                                                     |
| `SUBSCRIPTION_ACTIVATED`  | Any transition _into_ `ACTIVE` from a non-`ACTIVE` status (paired with `SUBSCRIPTION_UPGRADED` when driven by an Upgrade call)               |
| `SUBSCRIPTION_UPGRADED`   | Every successful Upgrade call, regardless of whether it also activates                                                                       |
| `SUBSCRIPTION_DOWNGRADED` | Every Downgrade call (fires when the change is _queued_, not when it's later applied — `effectiveAt` in the payload carries the future date) |
| `SUBSCRIPTION_CANCELLED`  | Cancellation                                                                                                                                 |
| `GRACE_PERIOD_STARTED`    | Both the `TRIAL`→`GRACE_PERIOD` and `ACTIVE`→`GRACE_PERIOD` cases (fires alongside `TRIAL_EXPIRED` in the first case, alone in the second)   |
| `SUBSCRIPTION_SUSPENDED`  | `GRACE_PERIOD` → `SUSPENDED`                                                                                                                 |

No event fires for a Downgrade actually being _applied_ at `renewalDate` (`applyDuePendingDowngrades`) — the plan change already had its own `SUBSCRIPTION_DOWNGRADED` event at queue-time, and re-announcing the same logical change a second time when it takes effect would be redundant, not a new fact for a listener to act on.
