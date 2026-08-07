# Settings Ownership Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-006 Volume-1 §3 — the canonical rule that Settings orchestrates existing bounded contexts rather than taking ownership of business entities
**Implemented in:** `apps/api/src/modules/settings/`

## Orchestration, not ownership, for pre-existing data

§3's own rule — "Workspace Settings owns only settings that have no existing bounded-context owner. Where another module already owns data, Workspace Settings acts as an orchestration interface" — is applied literally. Business Profile, Business Hours (including Timezone, which is a field within it, not a standalone concept), and Notification Settings all stay exactly where Volume-1's Architecture Review confirmed them: owned by the frozen `Workspace` schema (`apps/api/src/modules/workspace/schemas/workspace.schema.ts`), written through Workspace's own existing `PATCH /v1/workspaces/me/{business-profile,business-hours,notification-settings}` endpoints, unchanged.

`GET /settings` composes a single, unified read view (`SettingsOverview`) by reading Workspace's own document alongside Settings' own `WorkspaceSettings` document — a live read-through, not a cached or duplicated copy. There is no write path into orchestrated data anywhere in the Settings module; `SettingsController` has zero `POST`/`PATCH`/`DELETE` routes touching `businessProfile`/`businessHours`/`notificationSettings`. A client wanting to change those still calls Workspace's existing endpoints directly — confirmed end-to-end in `settings.e2e-spec.ts` ("reflects a change made through Workspace's own existing endpoint").

## New ownership only for genuinely new data

Branding (Workspace Logo), Currency, Date Format, and Time Format had no existing bounded-context owner (verified against the actual schema before implementation, not assumed) — Settings owns these outright in a new `workspace_settings` collection, keyed by `workspaceId`. This is the direct, mechanical consequence of §3's rule applied to the one category of overlap it actually authorizes Settings to own.

## Two deliberately-not-yet-touched items

- **Currency** is a display preference (resolved 2026-08-07, Architecture Review) — it has no effect on and makes no promise about actual billing currency, which stays INR-only platform-wide per Billing's own already-approved D002 decision. Defaults to `"INR"`, the same "reasonable India-market default" precedent `Workspace.businessHours.timezone` already established by defaulting to `"Asia/Kolkata"` — a technical/UX default, not a commercial value requiring GTM approval (TD-009's discipline doesn't apply to a display preference).
- **Language** stays exactly as Workspace already had it — read-only, fixed at `"en"`, per the existing, named `ADR-027`. `SettingsOverview.language` surfaces the current value for a unified view; no selector endpoint exists. See TD-017 for why this is deferred rather than resolved now.

## Reused permission, no fragmentation

Every Settings route — including the read (`GET /settings`) — is gated by `EDIT_WORKSPACE` (Owner FULL, Administrator FULL, everyone else NONE), the same permission already gating Workspace's own settings-shaped endpoints. Resolved 2026-08-07, Architecture Review, as the simpler choice over splitting reads under a broader `VIEW_WORKSPACE`-style gate and writes under `EDIT_WORKSPACE` — Settings is a small enough surface that one consistent gate is clearer than two.
