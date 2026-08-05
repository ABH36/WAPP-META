# COMM-005 — Template Versioning Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-3a recommendation #1)

## Context

Part-3a built create → submit → sync, but no "edit an existing template" capability at all — a `DRAFT` template's fields can only be set once, at creation, and nothing built so far ever mutates `name`, `category`, `language`, or `components` after that. Real usage will eventually need to revise a template (fix wording, add a variable, respond to a Meta rejection reason). This ADR sets the target strategy before that capability gets built, so it isn't designed ad hoc under deadline pressure later.

## Why this needs a real decision, not just "add an edit endpoint"

Two things make naive in-place editing dangerous:

1. **Message provenance.** `Message.rawPayload` for a template send stores `templateId` + the exact `bodyParameters` used at send time — but not a snapshot of the template's `components` as they were _then_. If a Template document is edited in place after messages were already sent under it, historical messages would silently misrepresent what was actually sent (the Message history would show a name/parameters, but looking up "what did this template actually say" would return today's edited text, not the text the customer received).
2. **Meta's own template identity.** Meta's WhatsApp Business Management API supports editing an already-`APPROVED` template's content in place (limited edits per day, same `metaTemplateId`, content change re-triggers review) — but also fully supports treating a content change as a brand-new template under a new name. Both are legitimate; picking one affects the local data model.

## Decision — Phase-1: new name per revision, never in-place content mutation post-submission

- A `DRAFT` template (never submitted, `metaTemplateId: null`) may still be edited freely — nothing external references it yet.
- Once a template is `PENDING` or later (`APPROVED`/`REJECTED`/`PAUSED`/`DISABLED`), its `name`, `category`, `language`, and `components` become **immutable**. "Editing" it means creating a **new** Template document — new Mongo `_id`, a new Meta template name (Meta requires unique names per WABA+language anyway), submitted through the exact same `create()` → `submit()` flow already built. No new Meta API surface required — `MetaApiClient.createTemplate()` already does everything this needs.
- The old Template document is never deleted or mutated — it stays exactly as it was, so any historical Message that references it (`rawPayload.templateId`) continues to resolve to the real content that was actually sent under it. This matches the project's standing "never hard-delete important business data" engineering standard, applied to a case that standard didn't originally anticipate.
- A `previousVersionId` field (linking a new Template to the one it revises) is a natural, low-cost addition once "revise" becomes a real UI action — not needed before then, since nothing today needs to walk a version chain.

## Why not Meta's in-place edit API (Strategy B) for Phase-1

Meta's own template-edit endpoint (same `metaTemplateId`, content replaced, status resets to `PENDING`) is the more "native" approach, but it reintroduces exactly the provenance problem above unless paired with local version-history storage (snapshotting `components` before each edit) — real additional complexity for a capability nothing in Phase-1 scope actually needs yet. Revisit if/when: (a) Meta's per-day edit-count limits make "always create a new template" meaningfully worse for real customers hitting template review turnaround repeatedly, or (b) a customer explicitly needs to preserve the same template name across revisions (e.g., an external integration hardcodes the template name).

## What this ADR does not do

No `previousVersionId` field, no edit endpoint, no version-history storage is added by this change — per the Architect's own framing, this is documentation only. It exists so whoever builds template editing next has a decided direction (new-name-per-revision, Strategy A) instead of re-deriving one, and knows the escape hatch (Strategy B) if Strategy A's limits are actually hit.
