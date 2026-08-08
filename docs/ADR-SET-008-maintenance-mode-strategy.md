# Maintenance Mode Strategy

**Status:** Accepted
**Date:** 2026-08-08
**Scope:** PRD-006 Volume-4 §4.6 — how Settings-owned Maintenance Mode configuration reaches Identity's login gate without inverting the codebase's established one-directional module dependency graph
**Implemented in:** `apps/api/src/modules/settings/services/maintenance-mode.service.ts`, `apps/api/src/modules/identity/listeners/maintenance-mode.listener.ts`, `apps/api/src/modules/identity/repositories/workspace-maintenance-state.repository.ts`, `apps/api/src/modules/identity/services/auth.service.ts` (`login()`)

## The dependency-direction problem

Every module import in this codebase points one way: Identity is the most upstream module (imported by Workspace, Communication, CRM, Billing, Settings), and nothing imports Settings. §4.6 requires `AuthService.login()` — Identity's own code — to check a Settings-owned configuration value (`WorkspaceSettings.maintenanceMode`) before issuing new tokens. A live cross-service call (Identity importing `SettingsModule`, injecting `MaintenanceModeService`) would be the first reverse dependency edge in the entire application and would also put a synchronous call to a completely different bounded context on the hottest, most latency-sensitive path in the app (every login attempt).

## Resolution: Settings emits, Identity keeps its own tiny local read model

```
PATCH /settings/maintenance  (Settings, EDIT_WORKSPACE)
        │
        ▼
WorkspaceSettings.maintenanceMode = true/false   (Settings owns the source of truth)
        │
        ▼
MAINTENANCE_MODE_ENABLED / MAINTENANCE_MODE_DISABLED   (already in §8's event list)
        │
        ▼
MaintenanceModeListener (Identity, @OnEvent — no module import needed,
EventEmitter2 is @Global())
        │
        ▼
WorkspaceMaintenanceState  (new, Identity-owned, tiny: {workspaceId, maintenanceMode})
        │
        ▼
AuthService.login() reads it — one fast local Mongo lookup, no cross-service call
```

No new module-import dependency is introduced in either direction — `EventEmitter2` is already `@Global()`, so any module can listen to any event without importing the emitting module, exactly the pattern Billing's own listeners already use to consume events from CRM/Workspace. This is a deliberate, justified exception to the general "avoid building a parallel projection" guidance from `docs/ADR-SET-004-identity-orchestration-strategy.md`: that guidance applies to _orchestration_ (Settings reading another module's data), not to this direction (Identity needing a fast local answer on its hottest code path to a question whose source of truth lives elsewhere). A live cross-service call at login would be strictly worse than a small, eventually-consistent local flag for a setting that's toggled rarely by an Owner/Administrator, not on every request.

## What "blocks new sessions, existing sessions continue" actually means in code

`AuthService.login()` gained one check, inserted after every existing gate (lockout, password, active, email-verified, workspace-membership-status) and before `recordSuccessfulLogin()`/token issuance — a login attempt for a workspace in maintenance mode is rejected with `ServiceUnavailableException` (503), and the attempt is recorded in Login History with reason `WORKSPACE_MAINTENANCE_MODE` like every other terminal login outcome. `AuthService.refresh()` and `reissueTokens()` are both separate code paths that never call `login()`'s gates at all (confirmed by reading `auth.service.ts` before making this change) — an already-issued access/refresh token pair keeps working exactly as before, satisfying §4.6's "Existing sessions continue" without any extra code, since those paths were never touched. A user with no workspace yet (`user.workspaceId === null`, Phase-1's pre-workspace-creation state) skips the check entirely — there's no workspace to be in maintenance mode for.

## Why the flag isn't a new WorkspaceStatus value

`WorkspaceStatus` (Trial/Active/Expired/Suspended/Cancelled) already has a precedent for exactly this kind of question: `docs/ADR-BILL-008-commercial-enforcement-strategy.md` deliberately kept `WORKSPACE_LOCKED`/`WORKSPACE_UNLOCKED` (Billing, per-counter feature locks) as their own concept, never touching the canonical `WorkspaceStatus` enum, specifically to avoid confusion with `Suspended` (reserved for fraud/abuse). Maintenance Mode follows the identical reasoning — it's an operational, admin-initiated, fully reversible state, unrelated to billing status or account standing, and lives as a plain boolean on `WorkspaceSettings` rather than as a sixth `WorkspaceStatus` value.
