# Usage Counter Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-005 Volume-3 §5/§6/§8/§9 — the canonical event-driven counter architecture
**Implemented in:** `apps/api/src/modules/billing/services/usage.service.ts`, `apps/api/src/modules/billing/listeners/usage-counter.listener.ts`, `apps/api/src/modules/billing/repositories/workspace-usage.repository.ts`

## Two separate collections, one per axis

§5 (Feature Entitlements — binary on/off per capability) and §6 (Usage Counters — numeric ceilings per resource type) answer different questions and are modeled as different fields on `PlanLimits` (per-Plan configuration) and `WorkspaceUsage` (per-Workspace live state) respectively — never conflated into one generic "limits" blob. `PlanLimits` is a new, separate Usage-owned collection keyed by `planId` (resolved 2026-08-07, Architecture Review) — the frozen Plan schema (Volume-1) stays untouched; §10's "Usage Rules" is its own box downstream of Plan, not a field on Plan itself.

## Event-driven, not live-queried

Resolved 2026-08-07, Architecture Review: counters are denormalized and kept current by listening to already-existing domain events, not by `WorkspaceUsageRepository` querying into CRM/Communication's own collections at check time. This matches the project's established event-driven integration pattern and avoids a new direct dependency from Billing into CRM/Communication's repositories.

## Only 6 of 9 counters have a real creation-time event

§6 lists 9 counters. `UsageCounterListener` wires exactly 6, each via the one existing event that represents that resource actually being created:

| Counter      | Event                    | Note                                                                    |
| ------------ | ------------------------ | ----------------------------------------------------------------------- |
| Team Members | `TEAM_MEMBER_ACCEPTED`   | Not `TEAM_MEMBER_INVITED` — a pending invite isn't consuming a seat yet |
| Customers    | `CUSTOMER_CREATED`       |                                                                         |
| Leads        | `LEAD_CREATED`           |                                                                         |
| Deals        | `DEAL_CREATED_FROM_LEAD` | The only creation path in this codebase — ADR-CRM-010                   |
| Broadcasts   | `BROADCAST_STARTED`      |                                                                         |
| Messages     | `MESSAGE_SENT`           |                                                                         |

The other 3 — Campaigns, Storage, API Requests — have no creation-time event to hook and are deferred (TD-013, extended during implementation to cover Campaigns as well as the two already-identified during Architecture Review):

- **Campaigns**: Communication's event catalog only has `CAMPAIGN_COMPLETED`/`CAMPAIGN_CANCELLED` — no `CAMPAIGN_CREATED`/`CAMPAIGN_STARTED` exists. Adding one means modifying frozen Communication code (Phase-4), out of scope here — same reasoning already applied to not retrofitting CRM/Communication for enforcement itself.
- **Storage**: uploads bypass the API entirely (`StorageService`, SEC-016) — the backend never sees file bytes or sizes.
- **API Requests**: the only existing request-counting infrastructure (`ThrottlerModule`, SEC-009) is a technical, platform-wide rate limiter, unrelated to a per-workspace commercial counter.

`WorkspaceUsage` still declares count fields for all 9 (schema completeness, matching how `Plan.monthlyPrice` stayed a real field while null pending approval) — the 3 deferred ones simply stay 0 forever, with no listener incrementing them.

## Counters are monotonically increasing

Resolved during implementation: `WorkspaceUsageRepository.incrementCounter()` only ever increases a count; nothing decrements one on archive/delete. §9 frames enforcement entirely around blocking new creation ("Reject new resource creation"), never around reclaiming room via deletion, and archived CRM records are explicitly meant to stay historical (BR-004) rather than be treated as freed capacity. A Workspace that archives many old Leads does not get room back under this design — a real, deliberate limitation, not an oversight, worth revisiting if it becomes a real customer complaint.

## Thresholds and locking are idempotent by construction

`WorkspaceUsage` carries a `*LastThresholdNotified`/`*Locked` field pair per tracked counter. `recordCreation()` only emits `USAGE_THRESHOLD_REACHED` for a threshold higher than the last one already notified, and only emits `WORKSPACE_LOCKED` on the transition into the locked state (not on every subsequent over-limit creation attempt) — both idempotency markers live on `WorkspaceUsage` itself, not derived by replaying history.

## Limits are not commercial numbers to invent

`PlanLimits`' numeric limit fields are seeded `null` for all three Plans — the same no-unapproved-commercial-value discipline already applied to `Plan.monthlyPrice`/`yearlyPrice` (TD-009): a specific figure like "10 Team Members" is exactly as much an unapproved commercial decision as a price, and `null` here means "not yet approved," not "unlimited." Tracked as TD-014. Entitlement booleans, by contrast, are seeded `true` for all three Plans — not a new invented decision, but a direct restatement of Plan's own Volume-1 schema comment ("same full feature set in Phase-1, differing only by usage limits").
