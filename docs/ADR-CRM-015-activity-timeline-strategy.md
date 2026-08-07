# Activity Timeline Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-5 (Activities, Tasks, Follow-ups & Notes)
**Implemented in:** `apps/api/src/modules/crm/schemas/activity.schema.ts`, `services/activity.service.ts`, `packages/shared-types/src/enums/activity.enum.ts`

## One collection, type-discriminated

`activities` is a single Mongo collection holding seven kinds of record — `NOTE`, `TASK`, `FOLLOW_UP`, `REMINDER`, `CALL`, `MEETING`, `EMAIL` — distinguished by a `type` field (`ActivityType`, immutable after creation, BR-002). This isn't a new decision made here: the enum was already pre-scaffolded with an explicit doc comment ("Phase-1 uses a SINGLE `activities` collection with this discriminator field — do not create separate collections/tables per type without a new ADR"), tracing to SAD-002 PATCH-003. Volume-5's own §4 confirms the same shape. Type-specific fields (`dueDate`/`priority`/`status` for Task; `followUpDate`/`followUpType` for Follow-up; `text`/`mentions` for Note; `reminderDate`/`reminderType` for Reminder) all live on the one schema as nullable columns, not as Mongoose schema discriminators — consistent with how every other entity in this codebase (Customer, Lead, Deal) uses one flat schema rather than polymorphic sub-documents.

## REMINDER stays its own type, despite §4's list omitting it

The pre-scaffolded `ActivityType` has 7 values including `REMINDER`; Volume-5 §4's own list has only 6 (no Reminder). Resolved during Architecture Review: `REMINDER` is kept as its own Activity Type, not folded into a property on Task/Follow-up — consistent with §16 listing "Reminder Triggered" as its own domain event, the same way `TERMINAL_DEAL_STAGES`-style named events elsewhere in this codebase always correspond to a first-class type, not a nested field.

## Reminder execution is explicitly out of scope here

§9 says reminder execution "is handled by the Notification module" and BR-007 says scheduling "never bypasses Notification ownership." No Notification module exists anywhere in this codebase yet (confirmed against D010's approved 18-module list — Notifications is its own, later module). Resolved: Part-5 is reminder-_scheduling_ CRUD only — `reminderDate`/`reminderType` are stored and validated, nothing detects when a reminder becomes due, and no `REMINDER_TRIGGERED` domain event is declared. Declaring an event with zero emitters would be dead code (nothing in this Part would ever call `eventEmitter.emit(REMINDER_TRIGGERED, ...)`); the event constant is deferred to whichever future Part actually builds the detection sweep and has something to fire it for.

## CRM Notes are a new, separate feature from Communication's Internal Notes

A planning-phase decision ("ADR-012" in the Business Decision Log) said CRM Notes and Communication's Internal Notes should be "the same underlying feature, no duplicate module." That resolution predates the current shape of Customer/Deal/Activity — Communication's Internal Notes attach to **Conversation** (`ConversationController`'s `POST/GET /communication/conversations/:id/notes`, already live, gated by `ADD_INTERNAL_NOTES`); Volume-5's Notes attach to **Customer/Deal** (§3, §5, §8). A Customer can have zero or many Conversations, so "the note on this Customer" and "the note on this Conversation" are different things once Customer and Conversation are distinct entities (true since Volume-1). Resolved during Architecture Review: build Volume-5's Notes as a new, separate feature — an `activities` document with `type=NOTE`, created via its own `POST /crm/notes` (§17), with its own `text`/`mentions` shape (richer than a generic Activity's `title`/`description`) rather than reusing `ConversationNote`. The earlier planning-phase resolution is treated as superseded by this document, not violated.

`POST /crm/notes` is a specialized creation endpoint, not a separate resource — the document it creates is a regular Activity, fully manageable afterward (`GET`/`PATCH`/archive) via the generic `/crm/activities/:id` routes, the same way Lead's three creation methods (Manual/WhatsApp/Existing-Customer) all converge on one `leads` collection.

## Two API-completeness gaps, resolved the same way

Two endpoints §17 doesn't list turned out to be needed by rules stated elsewhere in the same document:

- **`PATCH /crm/activities/:id/archive`** — BR-006 requires soft-delete, but §17 has no endpoint to invoke it. Added, matching the established Customer/Lead archive pattern.
- **`PATCH /crm/follow-ups/:id/assign`** — §11 states Follow-ups are assignable the same as Tasks, but only `/crm/tasks/:id/assign` is listed. Added for consistency with Task's own dedicated endpoint, applying the identical "add the missing endpoint" resolution the archive gap already established, without a second architecture round-trip for what is structurally the same category of gap.

## Task/Follow-up completion is read-only (BR-004/BR-005), Note/Call/Meeting/Email/Reminder are not

Once a Task's `status` reaches `COMPLETED`, or a Follow-up's `followUpCompletedAt` is set, every mutation (`update`, `assign`, and — for Task — a further `status` change) is rejected with 400, mirroring the read-only pattern already established for archived Customers/Leads and converted Leads. Follow-up's completion marker is a separate boolean-shaped field (`followUpCompletedAt: Date | null`), not `TaskStatus`, since §7 gives Follow-up no PENDING/IN_PROGRESS/CANCELLED concept — only "not yet done" vs. "done." Note/Call/Meeting/Email/Reminder have no completion concept at all in Volume-5 and stay editable (subject to the normal permission checks) for as long as the Activity exists.
