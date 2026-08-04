# EVENTS-001 — Domain Event Publishing Strategy

**Status:** Accepted
**Type:** Technical/cross-cutting architecture decision
**Date:** 2026-08-04
**Raised by:** Architecture Review (Phase-3 recommendations #1 and #2)
**Implemented in:** `apps/api/src/common/events/`, consumed by `apps/api/src/modules/workspace`

## Context

Architecture Review asked whether Workspace lifecycle events were already published into a Global Audit pipeline and a Notification pipeline. Neither existed: there was no event-emitter dependency, no domain-event abstraction, and no Audit or Notification module anywhere in the codebase — this document exists specifically so that answer isn't lost as an undocumented fact.

## Decision

Publish domain events now, from the business modules where the actions actually happen, using NestJS's standard `@nestjs/event-emitter` (wraps `eventemitter2`, in-process, synchronous-callback pub/sub — not a message queue). Real consumers (Global Audit Center per PRD-007, the Notification module) do not exist yet per the approved module order and are **not** built as part of this change. What's built now is the publish side plus one temporary consumer that proves it works.

### Why this satisfies both Audit and Notification with one mechanism

Both are just future listeners on the same events — there's no reason to build two separate publish paths. A `workspace.created` event is exactly as useful to "write an audit log row" as it is to "send a welcome notification." The publisher (`WorkspaceService`/`TeamService`) never needs to know which, or how many, consumers exist.

### Event catalog (`apps/api/src/common/events/domain-events.ts`)

| Event                        | Emitted from                                                                    | Payload                                                |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `workspace.created`          | `WorkspaceService.create()`                                                     | `workspaceId, ownerId, name, occurredAt`               |
| `workspace.updated`          | `WorkspaceService.update{BusinessProfile,BusinessHours,NotificationSettings}()` | `workspaceId, section, updatedBy, occurredAt`          |
| `team.member_invited`        | `TeamService.inviteMember()`                                                    | `workspaceId, email, role, invitedBy, occurredAt`      |
| `team.member_accepted`       | `TeamService.acceptInvitation()`                                                | `workspaceId, userId, role, occurredAt`                |
| `team.member_suspended`      | `TeamService.suspendMember()`                                                   | `workspaceId, userId, actorId, occurredAt`             |
| `team.member_reactivated`    | `TeamService.reactivateMember()`                                                | `workspaceId, userId, actorId, occurredAt`             |
| `team.ownership_transferred` | `TeamService.transferOwnership()`                                               | `workspaceId, previousOwnerId, newOwnerId, occurredAt` |

Names are dot-namespaced (`workspace.*`, `team.*`) and `EventEmitterModule.forRoot({ wildcard: true })` is configured specifically so a future listener can subscribe to a whole namespace instead of every event individually.

### Temporary consumer: `DomainEventLoggerListener`

`apps/api/src/common/events/domain-event-logger.listener.ts` logs every event through the app's structured Pino logger. This is **not** the audit trail and **not** notification delivery — it exists only to make the events provably observable right now (verified live: `domain event published: workspace.created {...}` appears in structured logs when a workspace is created) and should be deleted once a real listener (Audit or Notification) subscribes to these events for real.

### What's deliberately not built

- No persisted audit log collection/schema — that belongs to the Global Audit module (PRD-007), not to Workspace.
- No actual notification delivery (push/email/in-app) — that belongs to the Notification module.
- No event replay/outbox pattern, no at-least-once delivery guarantee — `eventemitter2` is in-process and fire-and-forget; if this process crashes between an action completing and a listener finishing, the event is lost. Fine for a logging listener; **not** fine for Audit once that module is real. Flagging now so it isn't assumed away later: the eventual Audit listener will need its own durability story (e.g., persist within the same DB transaction as the triggering write, not solely rely on the in-memory event).

## Known gap, flagged not fixed

The Architecture Review's list of 7 events didn't include **Member Removed** (`TeamService.removeMember()`) or **Invitation Revoked** (`TeamService.revokeInvitation()`) — both look like they belong on the same list by the same reasoning as Suspended/Reactivated. Not added here since it wasn't requested; noting it so it isn't silently missed when Audit/Notification consumers are actually built.

## Consequences

- Adding a Global Audit listener later is additive: register a new `@Injectable()` listener class with `@OnEvent(...)` handlers, no change to any business module.
- Same for Notification delivery.
- The event payloads above are the de facto contract those future modules will consume — changing a payload shape later is a breaking change for whatever's listening by then, same discipline as changing an API response shape.
