# Communication UI Strategy

**Status:** Accepted
**Date:** 2026-08-11
**Scope:** FRD-001 Volume-4 — Communication UI. How `apps/web` implements the Communication Dashboard, Broadcasts, Campaigns, Templates, and Automation Settings on top of the frozen Communication backend (PRD-004), without re-owning messaging, campaign execution, template approval, or automation logic.
**Implemented in:** `apps/web/src/{features/communication,services,types}`, `apps/web/src/app/(workspace)/communication`, `packages/ui/src/components/{conversation-card,chat-bubble,template-card,broadcast-card,campaign-card,contact-card,sidebar-group}.tsx`

## Broadcast and Campaign are built as two distinct resources, not one

The original planning document named only "Campaigns," but the backend implements Broadcast (a one-time bulk template send) and Campaign (a container orchestrating multiple Broadcasts — "waves" — over a shared audience) as two separate Mongoose collections, controllers, and status machines, confirmed during Architecture Review by reading the schemas directly, not just the ADR summaries. Resolved via `AskUserQuestion` (Recommended, Architect-approved): both are exposed independently — `broadcast.service.ts`/`broadcast-list.tsx`/`broadcast-detail.tsx` for standalone one-time sends, `campaign.service.ts`/`campaign-list.tsx`/`campaign-detail.tsx` for multi-wave orchestration, with `CampaignDetail` rendering its constituent waves using the same `BroadcastCard` the standalone screen uses (a Campaign wave _is_ a real Broadcast document, `Broadcast.campaignId` back-reference — not a separate data shape). Neither resource has an edit route on the backend — "Create" is the only mutation short of the status-transition actions (send/pause/resume/cancel on Broadcast, cancel-only on Campaign, which cascades to every still-active wave).

## "Send Progress," never "Delivery Summary"

`GET .../broadcasts/:id/stats` and `.../campaigns/:id/stats` return exactly `{pending, sent, failed, total}` — send-attempt outcomes only ("Layer 1": `sent` means "accepted by Meta," not delivered or read). Delivered/read breakdowns ("Layer 2") are documented in `ADR-COMM-007` as a future addition with "no code changes ship with this document" — they don't exist in any response today. `BroadcastCard`/`CampaignCard`/`broadcast-detail.tsx`/`campaign-detail.tsx` all label this data "Send progress," deliberately never "Delivery Summary," to avoid implying a guarantee the backend doesn't make.

## Target-contact selection is sourced from Conversations — there is no Contacts list endpoint

Creating a Broadcast or Campaign requires `targetContactIds`, but the backend has no Contact list/search route anywhere (confirmed by grepping the entire module — `ContactRepository` exposes only internal lookup methods, never through a controller). The only place a contact's id is jointly known with a human-readable name/phone is the Conversation list (`ConversationSummary.contactId`/`contactName`/`contactPhoneNumber`). `use-known-contacts.ts` surfaces the up-to-100 most recently active conversations' distinct contacts as the _only_ picker source for both Create forms — a deliberate, documented limitation (recently-active contacts only, not a full audience list), not an oversight. See `docs/TECH-DEBT.md` for the proper fix (a real Contacts list/search endpoint).

## Contacts is not a standalone module — a read-only panel inside Conversation View only

Same finding as above, applied to §4.5: with no list/get/update routes at all, a "Contact List, Contact Profile, Conversation History" screen has nothing to be built against. `ContactCard` (new in `packages/ui`) renders the two fields already embedded in `ConversationSummary` (`contactName`/`contactPhoneNumber`) inside `ConversationView`'s header — the entire surface Contact information gets this volume. "Conversation History" per contact isn't buildable either: Conversation is 1:1 with Contact (a unique compound index on `workspaceId, contactId`), reopened on new activity rather than creating new records, so there is no multi-conversation history to show even if a route existed.

## Templates: "Edit" creates a new document; "Delete" doesn't exist

Per `ADR-COMM-005`, a submitted Template (`status !== DRAFT`) is immutable — no PATCH route exists for any status, and there's no dedicated delete route either (a soft-delete `isDeleted` flag exists on the schema but no controller action flips it). `template-list.tsx` never offers an "Edit" or "Delete" action; creating a new Template (with a new name) is the only path to a revised version, matching the backend's own mechanism exactly. Create and Submit are deliberately two separate explicit actions (not auto-submit-on-create) — since a `DRAFT` Template can't be edited via any route either, an atomic create+submit whose submit half failed would leave an ambiguous, unrecoverable partial state; splitting them keeps every step visible and independently retriable.

## Template approval status is pull-sync only — "Sync from Meta" is a first-class action, not an afterthought

`TemplateService.syncFromMeta()` (`POST .../templates/sync`) is the _only_ mechanism that ever updates `status`/`rejectionReason` — Meta's real-time template-status webhook isn't wired up in this slice (`docs/COMM-TEMPLATE-LIFECYCLE.md`). `template-list.tsx` surfaces this as a visible "Sync from Meta" button (gated `MANAGE_TEMPLATES` at `FULL`) rather than implying live status via polling alone — polling the list doesn't change what the backend itself hasn't synced from Meta yet.

## Automation is "Automation Settings," not "Automation Rules" — the data model doesn't support a rule list

The backend exposes exactly one Settings object per workspace (`AutomationSettingsSummary`: `welcomeMessageEnabled`/`welcomeMessageText`, `awayMessageEnabled`/`awayMessageText`, `assignmentStrategy`), not a collection of named rules with individual trigger/action/status fields. `automation-settings-form.tsx` presents two toggles and one strategy dropdown — no rule-builder UI was introduced, matching the Architect's explicit instruction. Away-message firing depends on `Workspace.businessHours` (a separate, Workspace-owned screen from FRD-001 Volume-3) — the form links to `/workspace/business-hours` rather than duplicating business-hours configuration here.

## Dashboard composition: N status-filtered calls, no aggregation endpoint, and independently-gated card groups

No `communication/reports/dashboard`-style endpoint exists (see `docs/TECH-DEBT.md`). `communication-dashboard.tsx` composes its counts from four separate `GET /conversations?status=X&limit=1` calls reading `meta.totalRecords`, interpreting "Assigned" as `status === "ASSIGNED"` (a real, directly-queryable state) rather than "has any assignee," which the API can't answer in one call. "Recent Activity" substitutes the conversation list's own default `lastMessageAt`-descending order — no activity-feed endpoint exists. Conversation-derived cards (counts, recent activity, Inbox link) are gated on `REPLY_CONVERSATIONS`; the Campaign summary card and its links are gated independently on `VIEW_BROADCASTS`/`VIEW_TEMPLATES` — `MARKETING_EXECUTIVE` has full Campaign/Template access but zero Inbox access, the exact inverse of `SALES_EXECUTIVE`/`SUPPORT_MANAGER`/`SUPPORT_EXECUTIVE`, so each card group hides independently rather than an all-or-nothing Dashboard gate.

## Sidebar navigation mirrors the same per-permission visibility, not a single Communication-wide gate

`workspace-sidebar.tsx`'s Communication sub-items are each individually filtered — Inbox requires `REPLY_CONVERSATIONS`, Broadcasts/Campaigns require `VIEW_BROADCASTS`, Templates requires `VIEW_TEMPLATES`, Automation requires the universal `VIEW_WORKSPACE`. No role ends up with zero visible sub-items (every role has at least one of the two permission clusters), but the filtering itself is real, not cosmetic — it matches each screen's own read-access guard exactly (see `docs/ADR-FE-008-communication-inbox-strategy.md`, "Permission rendering").

## A new `SidebarGroup` primitive, not a bespoke Communication-only nav pattern

DS-001's Sidebar system (Volume-1) had no expandable/nested-item concept — every existing nav item was flat. §6's "Communication expands into..." language needed one, so `packages/ui/src/components/sidebar-group.tsx` was added as a genuine extension of the existing Sidebar primitives (matching the incremental-addition convention every prior volume has followed), not a one-off built directly in `apps/web`. It auto-expands when the current route is under `/communication` and collapses to icon-only (no flyout) when the Sidebar itself is in its collapsed rail mode, consistent with how `SidebarItem` already drops its label text in that state.
