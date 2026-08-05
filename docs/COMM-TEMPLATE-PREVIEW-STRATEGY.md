# Template Preview Strategy

**Status:** Accepted
**Type:** Future frontend-facing contract (documentation only — no implementation required by this document)
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-3a recommendation #3)

## Context

`Template.components` (`docs/COMM-TEMPLATE-LIFECYCLE.md`) stores Meta's own component shape close to verbatim — `HEADER`/`BODY`/`FOOTER`/`BUTTONS`, with `{{1}}`, `{{2}}`, ... placeholders in text. No frontend exists yet, but once one does, every screen that shows a template (the template list, the submission form, and — most importantly — the Shared Inbox's reply composer once it offers a template picker) needs to render the same visual preview. Without a documented contract, each screen would plausibly build its own slightly-different rendering logic.

## Decision — one shared rendering contract, three rules

1. **Placeholder substitution is purely positional and purely client-side for preview purposes.** `{{1}}`, `{{2}}`, ... map to a parameters array by index (1-based, matching Meta's own convention — already the exact rule `MessageService.sendTemplate()`'s `renderTemplatePreview()` implements server-side for message-history display). The frontend should implement the identical substitution rule, not reinvent one — same regex/replace semantics as `renderTemplatePreview()`.

2. **Preview uses sample values, real send uses real values — and the two must never be confused.** When an agent is composing (not yet sending), placeholders should render with clearly-marked sample text (e.g. `[Customer Name]`, `[Order ID]` — bracketed, visually distinct from real content) until the agent fills in real parameters, or with the agent's in-progress input once they start typing. This is a pure frontend-state concern; the backend has no "preview" endpoint and doesn't need one — `GET /communication/templates/:id` already returns the raw `components` array, which is all a preview renderer needs as input.

3. **Component rendering maps directly to WhatsApp's own visual layout**, since that's what agents and (eventually) customers already recognize:
   - `HEADER` (`format: TEXT`) → bold line above the body. Non-text header formats (`IMAGE`/`VIDEO`/`DOCUMENT`/`LOCATION`) render as a placeholder media block in preview (no actual media is stored or fetched by this slice — `Template.components` only carries the component's `format`, never a media asset), captioned with the format name (e.g. "Image header").
   - `BODY` → the main message text, placeholders substituted per rule 1.
   - `FOOTER` → small gray text below the body.
   - `BUTTONS` → rendered as tappable-looking rows below the message bubble, one per button entry, using each button's own `text` field. Button _behavior_ (what a `URL` or `PHONE_NUMBER` button actually does) is irrelevant to a preview — it's cosmetic only.

## Why this belongs in a shared doc, not "however the first frontend screen happens to build it"

Three separate future consumers (template list, submission form, reply composer) all need the same rendering — documenting it once, before any of them exist, means the second and third implementations reference this doc instead of reverse-engineering the first one's behavior (or worse, drifting from it). Same reasoning as `docs/ADR-COMM-003`'s timeline-ordering contract.

## What this document does not do

No preview component is built by this document, no backend preview endpoint is added, and no media-asset handling exists yet (Message/Template media support is a documented gap already — Part-1's Message schema doc notes media download/storage as later scope). This is purely the rendering contract for whenever a frontend picks this up.
