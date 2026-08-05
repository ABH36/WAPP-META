# Meta Compliance Engine

**Status:** Accepted
**Date:** 2026-08-05
**Scope:** PRD-003 Part 3a (Templates & Meta Compliance Engine)
**Implemented in:** `apps/api/src/modules/communication/services/compliance-engine.service.ts`

## What this closes

Part-1's `MessageService` doc comment explicitly flagged this as a known, deliberate gap: outbound free-text sends had no 24-hour customer-service-window check, relying only on Meta's own API-side rejection. Part-2's reply flow inherited the same gap. This module closes it — proactively, before any Graph API call is made — and, per **BDC-008**, governs _all_ outbound communication, not just this slice: 1:1 replies (Part 2) today, Broadcast/Campaign (Part 3b) next.

## The rule

Meta only allows free-form (non-template) messages to a WhatsApp user within **24 hours of their last message** — the "customer service window." Outside that window, only a pre-approved template message can reach them. This is Meta's own platform rule, not a WAPP business decision; the Compliance Engine's job is to enforce it proactively (clear WAPP-level error, before wasting a Graph API call) rather than relying solely on Meta's own rejection.

## Design

- `ComplianceEngineService.isWithinCustomerServiceWindow(conversation)` — `true` iff a Conversation exists and `Conversation.lastCustomerMessageAt` is within the last 24 hours. `null`/no Conversation is treated as outside the window — a contact who has never messaged in has no window to be inside.
- `assertFreeTextAllowed(conversation)` — throws `OutsideCustomerServiceWindowException` (403) otherwise.
- **Template sends never call this at all** — they're exempt by definition, that's the entire purpose of a template. `MessageService.sendTemplate()` has no compliance check in its path.

## Where it's enforced

`MessageService.sendText()` (used by both the raw Part-1 endpoint and Part-2's `ConversationService.reply()`) resolves the Contact and any existing Conversation, then calls `assertFreeTextAllowed()` — **before** the Meta API call, not after. This required reordering Part-1's original flow (Contact resolution used to happen after a successful send; it now happens before, so the compliance check has something to check against). See the code comment in `MessageService.sendText()` for the exact reasoning.

## An important asymmetry: sending a template does not open the window

Sending a template message to a brand-new contact (who's never messaged in) succeeds — templates are exempt — but it does **not** itself start the 24-hour window. The window only opens when the _customer_ replies (`ConversationRepository.recordActivity()` only updates `lastCustomerMessageAt` on `INBOUND` messages). A follow-up free-text message to that same contact, sent immediately after the template and before they've replied, is still correctly rejected. This is deliberate and matches Meta's actual rule — a template reaching someone isn't the same as them engaging — and is directly exercised by `template.e2e-spec.ts`.

## What's explicitly out of scope for this slice

- **Broadcast/Campaign enforcement** — Part 3b's job. The engine itself is shared infrastructure; Part 3b wires it into the bulk-send path.
- **Proactive UX** (warning an agent in the UI before they try to type a free-text reply outside the window, offering a template picker instead) — that's a frontend concern once a frontend exists; today the API simply returns a clear 403.
- **Per-message-type nuance** (media messages, interactive messages) — Part-1 only ever sends `text` and now `template` types outbound; the compliance check applies identically to both non-template cases (there's currently only one: text).

## Confidence note

The 24-hour figure and "template-required-outside-window" rule are Meta's own long-standing, stable WhatsApp Business Platform policy — not something this project could change even if it wanted to. This document describes WAPP's enforcement of an external rule, not a WAPP business decision.
