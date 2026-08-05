# COMM-009 — Campaign Analytics Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-3b-ii recommendation #2)

## The aggregation hierarchy

```
Campaign
  └─ Broadcast          (Broadcast.campaignId)         one Campaign, many waves
       └─ BroadcastRecipient  (BroadcastRecipient.broadcastId)  one wave, many recipients
            └─ Message        (BroadcastRecipient.messageId,    one recipient, one Message
                                Message.broadcastId is the       (both directions link the
                                reverse-lookup path)              same pair)
                 ├─ Delivery Metrics   (Message.status ∈ {DELIVERED, READ})
                 ├─ Read Metrics       (Message.status === READ)
                 └─ Conversion Metrics (Future — see below, not implemented, not yet possible)
```

Every link in this chain already exists in the schema — this ADR is the first document to name the full path end to end and state precisely which levels are queryable today versus reserved for later.

## What's queryable today, and how

| Level                                                 | Query path                                                                                | Status                                                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign → its waves                                  | `BroadcastRepository.findByCampaign(workspaceId, campaignId)`                             | **Implemented** (`CampaignService.listWaves()`)                                                                                                                |
| Wave → its recipients (send-attempt outcome)          | `BroadcastRecipientRepository.findByBroadcast()` / `.getStats()`                          | **Implemented** (`BroadcastService.listRecipients()`/`.getStats()`)                                                                                            |
| Campaign → rollup send-attempt stats across all waves | `CampaignService.getStats()` — sums each wave's `BroadcastRecipientRepository.getStats()` | **Implemented** — this is Layer 1 only, per `docs/ADR-COMM-007-broadcast-progress-strategy.md`                                                                 |
| Wave → delivery/read metrics (Layer 2)                | Would query `Message.find({ broadcastId, status: { $in: [DELIVERED, READ] } })`           | **Not implemented** — ADR-COMM-007 already named this gap at the Broadcast level; still open                                                                   |
| Campaign → delivery/read rollup across all waves      | Would query `Message.find({ broadcastId: { $in: waveIds }, ... })`, grouped               | **Not implemented** — the natural Campaign-level extension of the same gap, closed at the same time as the wave-level one (same underlying query, wider `$in`) |
| Campaign/Broadcast/Message → Conversion Metrics       | No query path exists — see below                                                          | **Not possible yet**, not just unimplemented                                                                                                                   |

## Why Conversion Metrics is a different kind of gap than Delivery/Read

Delivery and Read metrics are missing implementation but not missing data — `Message.status` already carries everything needed once someone writes the aggregation query. Conversion Metrics (e.g. "this Campaign generated N leads / M deals") is missing the **data itself**: nothing in the schema today links a `Message`, `BroadcastRecipient`, `Broadcast`, or `Campaign` to a downstream business outcome, because the entities that _are_ the outcomes (Lead, Deal) don't exist until CRM (Phase 5). Even once CRM ships, conversion attribution isn't a free byproduct of the existing schema — it needs an explicit mechanism (e.g., a `sourceCampaignId` field on the future Lead/Customer entity, set at creation time if the inbound contact can be traced to a Campaign they were part of) that has to be designed as part of CRM's own build, not bolted on from the Communication side.

## Recommended shape for when this is built

1. **Delivery/Read rollup** (Broadcast and Campaign level) — the immediately buildable piece. A single aggregation query per level, following the exact index (`Message.broadcastId`, already present) the current schema already supports. No schema changes needed.
2. **Conversion Metrics** — deferred until CRM exists. When it's designed, the attribution field belongs on the CRM entity (Lead/Customer), referencing back to `Campaign`/`Broadcast`, not the other way around — Communication shouldn't need to know about CRM entities to stay consistent with the module ownership boundaries already established (ADR-COMM-002's Contact-vs-Customer precedent).

## What this ADR does not do

No aggregation query, no new endpoint, no schema field is added by this document — per the Architect's framing, this is documentation only. It exists so whoever builds Campaign/Broadcast analytics next has the full hierarchy and the buildable-vs-not-yet-possible distinction already settled, instead of re-deriving it.
