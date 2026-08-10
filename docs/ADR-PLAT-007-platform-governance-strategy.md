# Platform Governance Strategy

**Status:** Accepted
**Date:** 2026-08-10
**Scope:** PRD-007 Volume-4 §4.3/§4.6 — Governance Policies & Global Configuration (merged). How platform-wide configurable behavior gets a single, versioned, audited source of truth without becoming two competing subsystems or silently reaching into frozen modules.
**Implemented in:** `apps/api/src/modules/platform/schemas/governance-policy.schema.ts`, `repositories/governance-policy.repository.ts`, `services/platform-governance-policy.service.ts`, `controllers/platform-policies.controller.ts`; `apps/api/src/modules/platform/repositories/platform-user.repository.ts`/`services/platform-users.service.ts` (role-change capability)

## §4.3 and §4.6 named the same settings twice — merged, not built in parallel

The source document's §4.3 (Governance Policies: Password Policy, Session Timeout, Platform Maintenance Defaults, Break-Glass Duration, Platform Login Policy) and §4.6 (Global Configuration: Default Session Duration, Default Retention, Platform Limits, Global Maintenance Defaults) describe what reads as the same underlying concept — "Session Timeout" and "Default Session Duration" are the same setting; "Platform Maintenance Defaults" and "Global Maintenance Defaults" are near-identically named. Building both literally, as two separate schemas behind two separate API surfaces (`PATCH /platform/policies/:id` vs. `PATCH /platform/configuration`), would have created exactly the two-sources-of-truth problem this codebase has consistently avoided elsewhere (ADR-PLAT-006's reasoning for not double-persisting audit data applies here just as directly).

Architecture Review, 2026-08-10, resolved this by merging: one `GovernancePolicy` collection, one `/platform/policies` API surface, covering every genuinely distinct item from both sections. §4.6's separate schema and `/platform/configuration` route were never built. `GLOBAL_CONFIGURATION_UPDATED` was never added to `domain-events.ts` — `PLATFORM_POLICY_UPDATED` covers every change, regardless of which of the two original sections a given key came from.

## The six keys, and the one deliberately missing

```ts
export enum GovernancePolicyKey {
  PASSWORD_POLICY = "PASSWORD_POLICY",
  SESSION_TIMEOUT = "SESSION_TIMEOUT",
  PLATFORM_MAINTENANCE_DEFAULTS = "PLATFORM_MAINTENANCE_DEFAULTS",
  PLATFORM_LOGIN_POLICY = "PLATFORM_LOGIN_POLICY",
  PLATFORM_LIMITS = "PLATFORM_LIMITS",
  DEFAULT_RETENTION = "DEFAULT_RETENTION",
}
```

"Break-Glass Duration" — the sixth item §4.3 named — is not in this enum. `SUPPORT_SESSION_MAX_DURATION_MINUTES = 240` (`platform.constants.ts`... actually `support-session.schema.ts`) was frozen by ADR-PLAT-005 as a fixed, non-configurable ceiling one volume ago. Architecture Review, 2026-08-10, confirmed it stays exactly that: "The 240-minute ceiling frozen in ADR-PLAT-005 is not converted into a runtime-editable policy." `PlatformGovernancePolicyService.update()` rejects `BREAK_GLASS_DURATION` the same way it rejects any string that isn't a real `GovernancePolicyKey` — a `BadRequestException`, verified in e2e. A future change to the 240-minute ceiling requires an explicit ADR-PLAT-005 supersession, never an implicit side effect of this volume's generic policy-key validation.

## Store-and-audit only — no frozen module is wired up this volume

Every one of the six keys' _purpose_ points at something a frozen module already controls today: `SESSION_TIMEOUT` at Identity's JWT TTL env vars, `PASSWORD_POLICY`/`PLATFORM_LOGIN_POLICY` at Identity's `AppConfig.auth` (bcrypt rounds, lockout thresholds — see `docs/ADR-AUTH-001-account-lockout-policy.md`), `DEFAULT_RETENTION` at Settings' `RetentionPolicy` schema-level defaults, `PLATFORM_MAINTENANCE_DEFAULTS` at Platform's own `PlatformMaintenanceState`. Architecture Review, 2026-08-10, was explicit that none of these connections get made this volume: "They are not wired into live Identity JWT lifetime, Settings retention defaults or other frozen module behaviour in this volume. Future runtime enforcement requires its own dedicated architecture review."

`PlatformGovernancePolicyService` has zero dependency on Identity or Settings — it only ever touches `GovernancePolicyRepository`. A Super Admin can set `SESSION_TIMEOUT` to any value today and nothing in Identity's token-signing code will read it. This is deliberate, not an oversight: wiring six different config values into three different frozen modules' live behavior, within one volume, would have meant invoking the frozen-module-governance checklist six separate times without dedicated review for any of them. TD-024 tracks this as the explicit next step.

## Versioning: upsert-by-key, history as a convenience, `PlatformAuditEntry` as the record of truth

§10's "Configuration Changes Require version increment" is enforced by `GovernancePolicyRepository.upsertByKey()`: the first `PATCH` for a key creates a document at `version: 1`; every subsequent `PATCH` pushes the document's _current_ `{value, version, reason, updatedBy, updatedAt}` onto its own `history` array before applying the new value and incrementing `version`. This collection is deliberately never seeded — BR-003 ("Governance Policy changes require justification") means every value that exists has a real, admin-supplied `reason` behind it; a system-seeded default with no real justification would be a value that exists without the very thing BR-003 requires. `GET /platform/policies` before any `PATCH` returns an empty list, not six pre-populated rows.

The document's own `history` array is a convenience for quickly seeing a policy's recent revisions inline — it is not the canonical audit trail. `PLATFORM_POLICY_UPDATED` (emitted on every `update()` call) is picked up by `PlatformAuditListener` and recorded as a durable, immutable `PlatformAuditEntry` (BR-004 — "Every policy change generates Platform Audit"), the same canonical-audit-trail role `PlatformAuditEntry` already plays for Break-Glass/Support Session lifecycle events (ADR-PLAT-006).

## `PATCH /platform/policies/:key`, not `:id` — a key, not a Mongo ObjectId

The route parameter is the policy's `GovernancePolicyKey` string (e.g. `SESSION_TIMEOUT`), not a database-generated id — the same shape Volume-1's `PATCH /platform/feature-flags/:key` already established for a small, finite, code-defined key set. `PlatformGovernancePolicyService.update()` validates the incoming string against `Object.values(GovernancePolicyKey)` and throws `BadRequestException` for anything else (including `BREAK_GLASS_DURATION`, see above) — there is no way to create a policy document for a key this codebase doesn't know about.

## Permissions

`GET`/`PATCH /platform/policies` are both gated behind `MANAGE_PLATFORM_POLICIES` — `PLATFORM_SUPER_ADMIN`-only for both read and write, unlike most of this codebase's VIEW/MANAGE permission pairs. §7 named only one permission for this subsystem (no separate `VIEW_POLICIES`), and these are the platform's own security-relevant configuration values (password rules, session timeouts, login lockout thresholds) — visibility itself is treated as sensitive here, deliberately different from `VIEW_PLATFORM_ANALYTICS`/`EXPORT_PLATFORM_REPORTS` (granted to Support roles) and consistent with `VIEW_COMPLIANCE` (also Super-Admin-only, see ADR-PLAT-008).

## Platform Permission Changes: a minimal, previously-absent capability

§4.4's Compliance Dashboard asked for "Platform Permission Changes" as an audited event stream, but no platform user's role could be changed after creation at all — `PlatformUsersService` had exactly three operations (`create`, `list`, `setActive`) before this volume. Architecture Review, 2026-08-10, authorized the minimal capability needed to make the widget real: `PlatformUsersService.updateRole()` (gated the same as every other Platform User mutation, `MANAGE_PLATFORM_USERS`, Super-Admin-only), a new `PLATFORM_USER_ROLE_CHANGED` domain event, and a 9th `PlatformAuditListener` handler. This also closes a real, independently-useful gap: before this volume, correcting a wrongly-assigned platform role required deleting and recreating the user (`PlatformUserRepository` had no `updateRole`, only `create`/`setActive`).
