# Identity Orchestration Strategy

**Status:** Accepted
**Date:** 2026-08-08
**Scope:** PRD-006 Volume-2 §4.5-§4.7/§11 — the canonical relationship between Settings and Identity, confirming Settings orchestrates Identity services without owning authentication or security data
**Implemented in:** `apps/api/src/modules/settings/services/security-settings.service.ts`, `apps/api/src/modules/identity/services/auth.service.ts`

## Settings is a thin proxy, Identity does the work

`SecuritySettingsService` has exactly one job: call the matching `AuthService` method and return its result. Every method is a one-line delegation — `changePassword`, `listSessions`, `revokeSession`, `revokeAllSessions` (→ `AuthService.logoutAllDevices`), `getLoginHistory`. No password, session, or login-history data is read or written anywhere in the Settings module; `SettingsModule` imports `IdentityModule` specifically to get `AuthService` (already exported for exactly this kind of cross-module use, the same pattern the Workspace module already established for `reissueTokens`/`revokeAllSessions`), a one-directional dependency (Settings depends on Identity, never the reverse).

## Why not event consumption

§7 of the relayed document named `PASSWORD_CHANGED`/`SESSION_REVOKED`/`LOGIN_SUCCESS`/`LOGIN_FAILED` as events Identity "emits" and Settings "consumes." Verified against the actual codebase before implementation: none of those four existed, and Identity (Phase-2) had never emitted a domain event of any kind. Resolved 2026-08-07, Architecture Review: Settings doesn't need them. Event consumption only makes sense when a subscriber is building its own projection of the source data — exactly what §11 ("Settings never owns... Login History") forbids. Direct method calls (`AuthService.listSessions()`, `AuthService.getLoginHistory()`) already give Settings live, always-current data with no projection to keep in sync, no risk of drift, and no new eventing infrastructure to add to a frozen module for a use case that doesn't need it.

## Two genuinely new Identity capabilities, added deliberately

Two pieces of §4.5/§4.7 had no existing implementation anywhere in Identity and were authorized as explicit extensions to a frozen module (Phase-2) as part of this volume, not something Settings could build on its own side without violating §11:

- **`AuthService.changePassword(userId, currentPassword, newPassword)`** — validates the current password, rejects reuse of the current password or any of the last `passwordHistoryLimit` (config, default 5) hashes, and revokes every session on success — the identical "credential change invalidates all sessions" posture `resetPassword()` already had, applied consistently to the authenticated path too. `User.previousPasswordHashes` (new field, `select: false` like `passwordHash` itself) holds the capped history.
- **`LoginHistoryEntry`** (new collection, `login_history`) — one immutable entry per login attempt for a _known_ user (an unknown email has no `userId` to attribute an attempt to), written at every terminal branch of `AuthService.login()`: `ACCOUNT_LOCKED`, `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED`, `WORKSPACE_ACCESS_SUSPENDED`, `WORKSPACE_ACCESS_REMOVED`, or success (`reason: null`). `LoginHistoryRepository` exposes no update/delete method — BR-007 ("Login History is immutable") is enforced structurally, the same insert-only shape already established for Billing History and Usage History.

## Self-scoped RBAC, not a new permission

Neither `EDIT_PROFILE` nor `EDIT_SELF` (§6's own proposal) exists in the `Permission` enum, and — verified before implementation — none of Identity's own existing self-scoped endpoints (`/auth/me`, `/auth/sessions`, `/auth/logout-all`) use `@RequirePermission()` at all, only the default `JwtAuthGuard`. Resolved 2026-08-07, Architecture Review: every route in `UserPreferencesController`/`SecuritySettingsController` follows that exact same pattern — authentication only, no permission check, no new entry added to the Permission Matrix. Every user, regardless of `TenantRole`, manages their own account identically.
