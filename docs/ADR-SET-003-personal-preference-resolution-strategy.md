# Personal Preference Resolution Strategy

**Status:** Accepted
**Date:** 2026-08-08
**Scope:** PRD-006 Volume-2 §4.2 — the precedence order between a personal User Override and the Workspace Default
**Implemented in:** `apps/api/src/modules/settings/services/user-preferences.service.ts`

## The precedence order

```
User Override
  ↓ (if null)
Workspace Default
  ↓
Effective Preference
```

`UserPreferences.dateFormat`/`timeFormat` (this volume) are nullable — `null` means "no personal override, inherit the Workspace's value." `WorkspaceSettings.dateFormat`/`timeFormat` (Volume-1) remain the fallback. `UserPreferencesService.getOverview()` resolves both into a single `EffectiveFormatSummary { value, source: "USER" | "WORKSPACE" }` per field, so a client never has to re-derive the precedence itself or fetch both Volume-1 and Volume-2 data to know what to actually display.

## Why this resolved the Duplicate finding, not a Reject

§4.2 proposing a user-level Date Format/Time Format looked, on first read, like a straight duplicate of Volume-1's already-shipped, workspace-owned fields. Resolved 2026-08-07, Architecture Review: it's a personal override layer on top of that existing default, not a second, competing concept — the same override-over-default pattern this document's own BR-002 already gestures at ("Workspace Settings override personal preferences where explicitly required" — read together with this resolution, personal preferences are the default winner _unless_ a workspace-level override is later introduced for a specific field, which Date Format/Time Format are not). Volume-1's `WorkspaceSettings` schema was not touched to support this — the override lives entirely in the new `UserPreferences` collection, keyed by `userId`.

## Timezone stays out of this pattern entirely

§4.2 states Timezone is "Read only. Inherited from Workspace" — no override concept applies to it. `UserSettingsOverview.timezone` is a direct passthrough of `Workspace.businessHours.timezone` (unchanged from Volume-1), never resolved against a personal value, because no personal value exists for it in this volume.

## Personal preferences never touch Workspace or vice versa

BR-001 ("User Preferences are personal. Never shared across Workspace members") is enforced structurally: `UserPreferences` is keyed by `userId`, and no code path anywhere lets one user's preference document affect another's, nor does resolving the _effective_ format for one user ever write back to `WorkspaceSettings`. The precedence order above is a **read-time computation**, not a write-time merge — changing the Workspace default (Volume-1) is instantly reflected for every user who hasn't set a personal override, with no migration or backfill needed.
