# COMM-004 — Conversation Search Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-2 recommendation #2)

## Context

The Shared Inbox needs to eventually support searching/filtering Conversations across six dimensions: Phone Number, Contact (name), Conversation Status, Labels, Date Range, and Full Text (message content). Part-2 shipped basic filtering only (`status`, `assignedToUserId`, pagination — see `ConversationRepository.list`). This ADR sets the target architecture for the rest, so later work extends toward one plan instead of each dimension being bolted on ad hoc.

## Decision — phase each dimension by the indexing strategy it actually needs

| Dimension                   | Strategy                                                                                                                                                                                                                                                                            | Status                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Conversation Status         | Exact-match filter on `Conversation.status`, already compound-indexed (`workspaceId, status, lastMessageAt`).                                                                                                                                                                       | **Shipped (Part 2).**                  |
| Date Range                  | Range filter on `Conversation.lastMessageAt` (already indexed as the sort key). Straightforward `$gte`/`$lte` addition to the existing `list()` query — no new infrastructure.                                                                                                      | Not yet implemented, trivial add.      |
| Phone Number                | Exact/prefix match on `Contact.phoneNumber` (already unique-indexed per `(workspaceId, phoneNumber)` — ADR-COMM-002). Resolve Contact first, then filter Conversations by `contactId`.                                                                                              | Not yet implemented, trivial add.      |
| Contact (name)              | Match on `Contact.waProfileName` — a self-reported, unindexed free-text field (see `contact.schema.ts`). A simple case-insensitive regex/prefix match is sufficient at Phase-1 volumes; a dedicated index only becomes worth adding once contact counts are large enough to matter. | Deferred, low effort when needed.      |
| Labels                      | Depends on the Labels feature itself, which Part 2 explicitly did not build (deferred — see the Part-2 completion report's scope note). No search strategy to define until the underlying field exists.                                                                             | Deferred — blocked on Labels shipping. |
| Full Text (message content) | See below — the one dimension that needs real architectural decisions, not just an index.                                                                                                                                                                                           | Deferred, needs the plan below.        |

## Full-text search — the actual decision

**Recommended path: MongoDB Atlas Search, not a separate search cluster.** The project already runs on MongoDB Atlas (per the Foundation/credentials setup) — Atlas Search gives Lucene-based full-text indexing on the existing `messages` collection with no second datastore, no second write path to keep in sync, and no additional operational surface (a standalone Elasticsearch/OpenSearch cluster would need its own deployment, monitoring, and a sync mechanism from Mongo — real infrastructure cost this MVP doesn't need yet).

Why not a plain Mongo `$text` index instead: `$text` search is workable but weaker (no relevance tuning, no fuzzy matching, one text index per collection which would need to cover `Message.text` only — fine as a stopgap, but Atlas Search is the same operational cost — since Atlas is already the hosting platform — for meaningfully better search quality). If full-text search is needed sooner than expected, a plain `$text` index is an acceptable stopgap that doesn't block the Atlas Search migration later; the query surface (`ConversationRepository.list`/a future dedicated search method) should be written so the underlying engine can be swapped without changing the API contract.

**Trigger to implement:** first real product need for message-content search (support/sales teams routinely searching "what did this customer say about X"), not before — same "don't build speculatively" discipline as [[project_wapp_observability_standard]].

## What this ADR does not do

Per the Architect's own framing, this is documentation only — no search endpoint, no Atlas Search index, no Labels field is added by this change. It exists so whoever builds search next (likely alongside or after Labels, since Labels search and full-text search are the two real remaining gaps) has a plan to build against instead of re-deriving one.
