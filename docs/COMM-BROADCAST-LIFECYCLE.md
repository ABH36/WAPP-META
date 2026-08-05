# Broadcast Lifecycle

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 3b-i (Broadcast Management)
**Implemented in:** `apps/api/src/modules/communication/{schemas,repositories,services}/broadcast*.ts`

## Audience model — explicit Contact list, not CRM segmentation

CRM (Customer/Lead segmentation — tags, status, lead source) doesn't exist until Phase 5; Communication only has the minimal `Contact` identity record (ADR-COMM-002 — phone number + self-reported profile name, no other attributes). Product Owner decision (2026-08-05): a Broadcast targets an **explicit, manually-assembled list of Contact ids** (`targetContactIds`) — no smart segmentation in this slice. When CRM ships, richer audience-building (by tag, status, lead source) becomes possible without changing how a Broadcast itself is _executed_ — only how its target list gets assembled.

## Status model

```
DRAFT -----send-----> RUNNING ---------> COMPLETED
  |                       |  \
  |                    pause  \--(template not/no-longer approved)--> FAILED
  |                       v
SCHEDULED --(fires)--> RUNNING <--resume-- PAUSED
  |
  +--cancel--> CANCELLED (from DRAFT, SCHEDULED, RUNNING, or PAUSED)
```

No approval-gate status exists — BDC-009 confirmed the Broadcast Approval Flow is deferred to a Future Phase; Phase-1 ships with no send-review gate (an accepted risk, not an oversight).

| Status      | Meaning                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DRAFT`     | Created, not yet started. `POST .../send` is required to start it.                                                                                                                                                     |
| `SCHEDULED` | Created with a future `scheduledAt` — a BullMQ delayed job fires automatically at that time, no explicit send needed.                                                                                                  |
| `RUNNING`   | Actively fanning out (or was, before a pause).                                                                                                                                                                         |
| `PAUSED`    | Fan-out stopped mid-run; remaining recipients stay `PENDING`, resumable.                                                                                                                                               |
| `COMPLETED` | Every recipient reached a terminal state (`SENT` or `FAILED`) — a Broadcast with some individual recipient failures still completes; partial success is normal for bulk send, not a Broadcast-level failure.           |
| `CANCELLED` | Manually cancelled before or during a run.                                                                                                                                                                             |
| `FAILED`    | The one automatic failure path: the referenced Template is not (or is no longer) `APPROVED` at run time — checked before any sends are attempted, so a Broadcast never partially sends against an unapproved template. |

## No per-recipient personalization in this slice

`bodyParameters` is a single array applied identically to every recipient. `Contact` has no reliable per-contact attributes beyond `phoneNumber`/`waProfileName` (self-reported, not authoritative) to personalize a message with — real personalization (e.g., "Hi {{customer.firstName}}") needs CRM's richer Customer record. This is a deliberate scope boundary, not a forgotten feature: revisit once CRM ships real per-customer attributes worth substituting in.

## Execution model — sequential, single-job fan-out (and its scaling limit)

`BroadcastExecutionProcessor` runs one BullMQ job per "run" (initial send, scheduled fire, or resume), and `BroadcastService.executeRun()` processes every `PENDING` `BroadcastRecipient` **sequentially, inside that one job**, with a small fixed delay (`BROADCAST_SEND_DELAY_MS`, 250ms) between sends as a basic courtesy toward Meta's per-number rate limits — not real throughput tuning.

**Known scaling limit:** for a very large recipient list (thousands+), this single job runs for a correspondingly long time, tying up one BullMQ worker slot for the whole duration — there's no parallelism across recipients, and no chunking into multiple jobs. At Phase-1 SMB-beachhead volumes (D001) this is an acceptable, simple, easy-to-reason-about design (pause/resume/cancel all just work by having the loop re-check `Broadcast.status` before every send). Revisit if/when real broadcast sizes make single-job duration a problem — the natural fix is chunking `BroadcastRecipient` batches into separate BullMQ jobs (already using `BROADCAST_RECIPIENT_BATCH_SIZE`-sized batches internally, so the seam to split on already exists) rather than a full redesign.

## Why a separate `BroadcastRecipient` collection, not an embedded array

A Broadcast could target thousands of Contacts. Embedding recipients as an array on the `Broadcast` document risks MongoDB's 16MB document limit and makes every per-recipient status update (`SENT`/`FAILED`) a write against a large, shared, high-contention document. `BroadcastRecipient` is its own collection — one row per `(Broadcast, Contact)`, uniquely indexed to guarantee no double-enrollment — mirroring the same reasoning already applied to `Message` vs. `Conversation` (Part 2).

## Relationship to Message and delivery status

`Message.broadcastId` links a Broadcast-originated outbound Message back to its Broadcast (Part 3b addition to the Part 1 schema); `BroadcastRecipient.messageId` links the other direction. `BroadcastRecipient` only tracks **send-attempt** outcome (`PENDING`/`SENT`/`FAILED`) — it deliberately does not duplicate delivery/read status, which already lives on the real `Message.status` state machine (`docs/COMM-MESSAGE-STATE-MACHINE.md`). A future "delivery rate" report reads `Message.status` for `broadcastId`-tagged messages, not a second copy of that state here.

## What this document does not cover

- Campaign (Part 3b-ii) — the segmentation/scheduling/orchestration layer that will sit on top of one or more Broadcasts.
- The Meta Compliance Engine's 24h window — irrelevant here, since every Broadcast send goes through `MessageService.sendTemplate()`, which is exempt by design (`docs/COMM-COMPLIANCE-ENGINE.md`).
