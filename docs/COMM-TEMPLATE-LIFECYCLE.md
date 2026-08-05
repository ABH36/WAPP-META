# Template Lifecycle

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 3a (Templates), BDC-010
**Implemented in:** `apps/api/src/modules/communication/{schemas,repositories,services}/template*.ts`

## Status model

```
DRAFT --submit--> PENDING --Meta review--> APPROVED
                                   \--> REJECTED

APPROVED --Meta-side action--> PAUSED | DISABLED
```

| Status                | Meaning                                                                                                                                                                                                             | Set by                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `DRAFT`               | Created locally, never submitted to Meta. The only status a template can be sent... never — see "Sending" below.                                                                                                    | `TemplateService.create()`                                                 |
| `PENDING`             | Submitted, awaiting Meta's review.                                                                                                                                                                                  | `TemplateService.submit()`                                                 |
| `APPROVED`            | Meta approved it — the only status a template can actually be sent in.                                                                                                                                              | `TemplateService.submit()` (rare synchronous approval) or `syncFromMeta()` |
| `REJECTED`            | Meta rejected it, with a reason (`rejectionReason`).                                                                                                                                                                | `syncFromMeta()`                                                           |
| `PAUSED` / `DISABLED` | Meta paused/disabled a previously-approved template (quality or policy issue) — tracked so `MessageService.sendTemplate()`'s `status !== APPROVED` check correctly blocks sending, not just "was it ever approved." | `syncFromMeta()`                                                           |

BDC-010 confirmed in-platform template **creation and submission** is Phase-1 scope — not just syncing already-approved templates (which is all Part-1's original `TEMP-BR-001` covered).

## Sync strategy: pull, not push (known gap)

`TemplateService.syncFromMeta()` is a **pull-based** sync — call it, and it fetches the current template list + status from Meta's WhatsApp Business Management API and upserts local records. Meta also offers a real-time `message_template_status_update` webhook event, which would push approval/rejection outcomes the moment they happen instead of waiting for a manual sync call.

**This webhook is not wired up in this slice.** Reasons: it's a genuinely different webhook shape/subscription from the existing `WebhookService` (which handles `messages`/`statuses` fields on a phone-number-scoped webhook, not a WABA-level template-status field), and adding it would have expanded Part-3a's scope beyond Templates + Compliance Engine. Until it exists, template approval outcomes are only as fresh as the last `POST /communication/templates/sync` call — a real, known gap, not a silent one.

**Closing this out looks like:** subscribing to `message_template_status_update` in Meta's App Dashboard, adding a handler alongside `WebhookService`'s existing `messages`/`statuses` handling (or a sibling service, since the payload shape and subscription are unrelated to per-phone-number message webhooks), and calling the same status-mapping logic `syncFromMeta()` already has.

## Sending a template message

`MessageService.sendTemplate()` requires `Template.status === APPROVED` — anything else (including `DRAFT`, which was never even offered to Meta) is rejected with a `403`. Body parameters are substituted positionally into the template's `BODY` component's `{{1}}`, `{{2}}`, ... placeholders.

**Not supported in this slice:** header parameters (e.g. a dynamic image/document in the header) and button parameters (e.g. a dynamic URL suffix on a call-to-action button). Only body-text substitution. Most early-usage templates are body-only; header/button parameter support is a natural, contained follow-up once a real template needs it — not blocked on anything architectural.

## Component modeling

`Template.components` stores Meta's own component array shape close to verbatim (`TemplateComponent[]` — `type`/`format`/`text`/`buttons`) rather than a fully-typed union of every header format and button type Meta supports. Meta's own template review is the actual source of truth for structural validity; this slice's job is to store and display what's submitted, not independently re-validate it.

## What this document does not cover

- The Compliance Engine's 24-hour window enforcement — see `docs/COMM-COMPLIANCE-ENGINE.md`.
- Broadcast/Campaign's use of templates (referencing a Template to send to an audience) — Part 3b scope.
