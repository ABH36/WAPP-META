# Deal Lifecycle Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Scope:** PRD-004 Volume-4 (Deal Management)
**Implemented in:** `apps/api/src/modules/crm/schemas/deal.schema.ts`, `crm.constants.ts`, `services/deal.service.ts`, `controllers/deal.controller.ts`

## The pipeline

```
OPEN → QUALIFICATION → PROPOSAL → NEGOTIATION → WON
  │         │              │            │
  └─────────┴──────────────┴────────────┴──→ LOST
                                                │
                                          (reopen) → OPEN
```

WON and LOST are terminal. LOST may be reopened — always back to OPEN, never to whatever stage it was lost from (resolved 2026-08-06: simpler, unambiguous, and avoids tracking a "stage before LOST" field solely for this). WON may never be reopened (§7, no exception).

## LOST is reachable from every non-terminal stage, not just OPEN

Volume-4 §4's diagram literally shows only `OPEN → LOST` as the alternative path. Taken at face value, that would mean a Deal that has already progressed to QUALIFICATION/PROPOSAL/NEGOTIATION could never be marked Lost directly. Resolved the same way an almost identical situation was resolved for `LeadStatus` (`docs/ADR-CRM-005-lead-qualification-strategy.md`) — that PRD's diagram was also linear-looking, but `LOST`/`UNQUALIFIED` were made reachable from every non-terminal status in the actual `LEAD_STATUS_TRANSITIONS` matrix, because a Lead (and, by the same real-world reasoning, a Deal) can realistically die at any stage, not only at the very start. `DEAL_STAGE_TRANSITIONS` (`crm.constants.ts`) implements this: every non-terminal stage's transition list includes `LOST` alongside its one forward-progress target.

## The CREATE_DEALS / CLOSE_DEALS split, and why one endpoint needs an inline check

Resolved during Architecture Review: `CREATE_DEALS` governs create (N/A here — see below), general updates, and assignment; `CLOSE_DEALS` governs the terminal WON/LOST transition and reopen. But §16 defines a single `PATCH /crm/deals/:id/stage` endpoint for **every** stage change, terminal or not — there's no separate "close" endpoint to decorate with `CLOSE_DEALS` alone. A Sales Executive (has `CREATE_DEALS`, lacks `CLOSE_DEALS`) must be able to reach this endpoint to move a Deal through QUALIFICATION/PROPOSAL/NEGOTIATION, but must be rejected the moment the target is WON or LOST.

`DealController` therefore decorates `/:id/stage` with `CREATE_DEALS` (the broader grant, so non-terminal moves work), and `DealService.updateStage` does an additional, inline `getPermissionLevel(actorRole, Permission.CLOSE_DEALS)` check only when the target is in `TERMINAL_DEAL_STAGES`. This isn't a new pattern — `ConversationService.assign` already checks a specific permission inline (`REPLY_CONVERSATIONS`) for a sub-case of an already-decorator-gated endpoint; this is the same technique applied to the acting user's own role rather than an assignee's.

`POST /crm/deals/:id/reopen` is decorated with `CLOSE_DEALS` directly — it's always a terminal-adjacent action, so no inline check is needed there.

## Deal creation stays exclusive to Lead Conversion

`CREATE_DEALS` is a pre-scaffolded permission with broad grants (Owner/Admin/Sales Manager/Sales Executive = FULL), and §16 lists `POST /crm/deals` — but resolved during review: this is **not** implemented. Lead Conversion (`docs/ADR-CRM-010-deal-creation-boundary.md`) remains the only creation path; `sourceLeadId` stays required and unique-indexed. `CREATE_DEALS`'s actual job in this implementation is gating updates and assignment, not creation — the permission name is a legacy of the pre-scaffold, not a literal description of what it gates today.

## No read-only restriction on general fields after WON/LOST

Unlike Lead's post-conversion immutability (`docs/ADR-CRM-011-lead-conversion-state.md`, an explicit BR-006 rule), Volume-4 states no equivalent rule for a closed Deal's `title`/`description`/`value`/`probability`/`expectedCloseDate`. `DealService.update()` imposes no terminal-stage guard — correcting a closed Deal's final value or adding a closing note is ordinary CRM behaviour, not the kind of structural, one-way transformation Lead Conversion is. Flagged here as a reasoned default rather than silently assumed; only the `stage` field itself is guarded (by `DEAL_STAGE_TRANSITIONS`, which correctly has no outbound entries for WON/LOST).

## Probability is manually set, not derived from stage

`probability` (BR-005: 0–100) has no stage-to-percentage table anywhere in Volume-4, and §9's "Expected Revenue = Value × Probability" formula reads as two independent inputs multiplied together, not one deriving the other. `DealService` never auto-sets `probability` on a stage change — it's a plain field on `UpdateDealDto`, validated but not computed. Flagged as a reasoned assumption in the absence of a stated rule, not a silent one.
