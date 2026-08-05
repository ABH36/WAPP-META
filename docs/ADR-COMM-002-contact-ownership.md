# COMM-002 — Communication Contact Ownership

**Status:** Accepted
**Type:** Cross-module data-ownership decision
**Date:** 2026-08-05
**Raised by:** Architecture Review (Phase-4 Part-1 recommendation #2), formalizing a decision already made and implemented during Part-1 (asked and resolved with the Product Owner, 2026-08-05)
**Implemented in:** `apps/api/src/modules/communication/schemas/contact.schema.ts`

## Context

ADR-007 (PRD-004 Volume 2) defines the Phase-1 dedup rule: an incoming WhatsApp message looks up the sender's phone number against **Customer** — if one exists, link it; if not, create it. Customer is a CRM entity (PRD-004). When Architecture Review reordered the module sequence (2026-08-04) to Identity → Workspace → **Communication** → CRM → Billing → Settings → Platform Administration, Communication became the first module to receive inbound WhatsApp messages — but Customer, the entity ADR-007 depends on, doesn't exist until CRM.

## Decision

**Communication owns a minimal, standalone Contact record** — not a stub of Customer, not a forward-declared partial Customer. `Contact` holds exactly what an inbound/outbound message needs to identify who it belongs to:

```ts
{
  workspaceId: string;
  phoneNumber: string; // E.164, the master identifier (BDC-013)
  waProfileName: string | null; // self-reported, never authoritative
  firstSeenAt: Date;
  lastSeenAt: Date;
}
```

Deduplicated per `(workspaceId, phoneNumber)` (unique compound index) — the same rule BDC-013 established for Customer, applied one layer earlier.

**When CRM is built, it absorbs/references Contact — it does not duplicate phone-number ownership.** The exact mechanism (CRM's Customer schema holds a `contactId` reference; or Contact is promoted/renamed in place; or CRM reads Contact directly and layers Lead/Deal/Pipeline data around it) is a CRM-phase implementation decision, not decided here — what _is_ decided is the principle: **there will be exactly one place per workspace that owns "this phone number = this identity," and it's Contact, not a second copy inside CRM.** ADR-007's actual dedup _logic_ (Lead/Customer creation-or-link) still lives in CRM when CRM is built; Contact's job is narrower — it's the identity record a Message points to, nothing more.

## Why not build a fuller entity now

Considered and rejected: giving Contact CRM-shaped fields now (tags, source, status) to save a migration later. Rejected because Communication has no business reason to know about Customer Status, Lead Source, or any other CRM concept — adding those fields here would mean Communication either leaves them unused (dead schema) or starts making CRM-domain decisions it doesn't own. `Contact` stays exactly as wide as messaging requires; CRM decides its own shape when it's built, informed by whatever `Contact` actually looks like at that point.

## Consequences

- No duplicate phone-number-to-identity mapping across modules — one dedup point per workspace, in Communication, until CRM exists and takes over the full ADR-007 rule.
- CRM's Phase-5 design must explicitly account for existing Contact data (workspace already has real inbound-message history by the time CRM ships) — this is a known, accepted migration/absorption task for that phase, not a gap in Communication.
- If CRM ultimately needs fields Contact doesn't have, those fields belong on CRM's own Customer schema referencing Contact, not retrofitted onto Contact.
