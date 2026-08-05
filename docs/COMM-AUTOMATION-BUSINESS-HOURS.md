# Automation Engine — Business Hours + Welcome/Away Messages

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 4a (Automation Engine — Business Hours + Welcome/Away Messages)
**Implemented in:** `apps/api/src/modules/communication/{business-hours.util.ts,schemas/automation-settings.schema.ts,repositories/automation-settings.repository.ts,services/automation.service.ts}`

## What this slice owns

Part 4a adds exactly two customer-facing auto-replies: a **Welcome** message on a Contact's very first-ever inbound message, and an **Away** message on any later inbound message received outside the workspace's configured Business Hours. Both are opt-in per workspace (`AutomationSettings.welcomeMessageEnabled`/`awayMessageEnabled`), each with its own free-text body. Auto Assignment (Part 4b) and SLA Monitoring + Escalation Rules (Part 4c) are later, separately-reviewed slices — this document covers Part 4a only.

## Business Hours is read, not owned, here

`Workspace.businessHours` already exists (Phase-3, PRD-006 ADR-028) — Part 4a consumes it as-is rather than redefining it. `WorkspaceModule` now exports `WorkspaceRepository` (previously exported nothing) so `CommunicationModule` can import it and read `businessHours` directly, the same cross-module pattern already used the other direction for `IdentityModule` exporting `UserRepository`/`AuthService`.

`isWithinBusinessHours(businessHours, at)` (`business-hours.util.ts`) is a pure function: timezone-aware via `Intl.DateTimeFormat` (no new dependency — same reasoning as `MetaApiClient` using the built-in `fetch`), and holiday-aware (`publicHolidays` short-circuits to closed regardless of the day's schedule). A day with no schedule entry at all, or an entry explicitly marked `isOpen: false`, is closed.

## Where AutomationSettings lives

`AutomationSettings` is a new, Communication-owned schema (`workspaceId` unique, one document per workspace), not a field added to the already-approved/frozen Phase-3 `Workspace` schema — the same module-ownership boundary already established for Contact vs. Customer (ADR-COMM-002). `AutomationSettingsRepository.findOrDefault()` returns an in-memory default object (`{welcomeMessageEnabled: false, ...}`) rather than throwing or creating a row when nothing has been configured yet, so evaluation never has a null-settings case to special-case.

## Trigger logic

`AutomationService.maybeSendAutoReply()` is called once, by `WebhookService`, immediately after every inbound message is persisted. It never throws — a failure here must not fail the inbound webhook request itself, matching the same reliability reasoning `WebhookService`'s own class doc already states for malformed payloads (Meta can disable a subscription after repeated failures).

- **Welcome** fires when `Conversation.status === NEW`. `NEW` is only ever set at Conversation creation and never re-entered on reopen (`conversation-state-machine.ts`), so it is a reliable "this Contact's first-ever message" signal without a separate "have we ever messaged this Contact" query.
- **Away** fires on any non-`NEW` status, when `isWithinBusinessHours()` is false for the workspace's configured hours at the moment the message arrived.
- Welcome and Away are mutually exclusive per message (a NEW conversation only ever evaluates the Welcome branch, never falls through to Away in the same call) and neither depends on the other having fired.

## Cooldown is per auto-reply type, not shared — and why that matters

`Conversation` carries two independent timestamps, `welcomeLastSentAt` and `awayLastSentAt`, each throttled to at most one send per `AUTO_REPLY_COOLDOWN_HOURS` (currently a fixed 12h constant, not yet per-workspace-configurable — same simplification pattern as `CONVERSATION_AUTO_CLOSE_HOURS`/TD-003). This was deliberately **not** a single shared `lastAutoReplyAt` field: an earlier version tried that, and it meant a Contact who received a Welcome reply on their first message became unable to receive an Away reply for the next 12 hours even after genuinely messaging again outside business hours — two semantically different notifications competing for one cooldown slot. Each branch checks only its own field, so Welcome firing never blocks Away (or a repeat Welcome scenario, which can't happen since `NEW` only occurs once) from firing later in the same window.

Each branch still checks its own cooldown _before_ fetching `AutomationSettings`, so a Contact sending several messages in a row within the cooldown window doesn't cost a settings lookup per message, matching the original design's intent.

## What this document does not cover

- Auto Assignment (Part 4b) — round robin / least active agent, per ADR-014. Not started.
- SLA Monitoring + Escalation Rules (Part 4c) — not started; scoped to emit a real in-system action plus a domain event (for the future Notification module), same pattern as the existing Conversation auto-close sweep.
- Per-workspace-configurable cooldown duration — today's `AUTO_REPLY_COOLDOWN_HOURS` is a fixed constant, documented as a known simplification, not a limitation of the per-type cooldown design itself.
