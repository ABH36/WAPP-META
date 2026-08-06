# CRM-003 — Customer Merge Strategy

**Status:** Accepted
**Type:** Future architecture (documentation only — no implementation required by this ADR)
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-1 recommendation #1)

## This is a different problem than the duplicate prevention Part-1 already has

Part-1 already prevents one class of duplicate: `CustomerRepository`'s unique `(workspaceId, contactId)` index plus `CustomerService.create()`'s pre-check reject a second Customer for a Contact that already has one (`docs/ADR-CRM-001-customer-identity-strategy.md`). That closes the case where the same Contact gets a Customer created for it twice.

**Merge is for a different situation:** two Customer records that turn out to represent the same real-world business relationship, but reference two _different_ Contacts — e.g. a customer who first messaged on WhatsApp from one number, then was also manually entered under a second number, and both records exist independently because Contact's own dedup (by phone number, ADR-COMM-002/BDC-013) never saw a collision. Nothing in Part-1 detects or prevents this — it's a real gap, not an oversight, since resolving it needs a human judgment call (are these actually the same customer?) that Part-1's scope never asked for.

## What a real merge needs, that doesn't exist yet

**A decision on which Contact survives.** Since `Customer.contactId` is a permanent, immutable reference (ADR-CRM-001), merging two Customers means choosing one of their two Contacts to keep and one to retire — Customer's own identity model has no concept of "references two Contacts" or "Contact changed after creation." This is the first structural question a merge design has to answer, and it touches Communication's data (Contact), not just CRM's.

**A decision per preserved relationship:**

- **Contact Preservation** — does the losing Contact get deleted, archived, or just orphaned (no Customer pointing to it, but the record stays for message history)? Contact has no status/archive concept today (`contact.schema.ts` — only `isDeleted`, used solely for Broadcast-audience validation), so "archive the losing Contact" isn't a mechanism that exists yet.
- **Conversation Preservation** — a Conversation is keyed to one Contact (`Conversation.contactId`, unique per workspace). Two merged Customers' two Contacts each have their own Conversation history; merging doesn't currently have a way to combine two Conversation threads into one timeline.
- **Deal Preservation** — Deal doesn't exist yet (Part-4). Whatever foreign key Deal ends up holding to Customer (`customerId`, presumably) needs a defined behavior for "the Customer it pointed to no longer exists, reassign to the surviving one" — impossible to design correctly before Deal's own schema is built.
- **Activity Preservation** — same issue as Deal: Activity doesn't exist yet (Part-5), and its relationship to Customer isn't decided.

## Why this can't be designed now

Two of the four preservation questions (Deal, Activity) depend on schemas that don't exist yet — any merge design written today would be guessing at foreign key shapes Part-4/Part-5 haven't approved. The other two (Contact, Conversation) are answerable today but are Communication-module changes (a Contact status/archive concept, a Conversation-reassignment operation), not CRM-only work — exactly the kind of cross-module expansion this codebase's established pattern (TD-003, TD-004, TD-005) treats as its own deliberate scoping decision, not something to fold into an unrelated ADR.

## What this means going forward

Customer Merge should be scoped after Deal and Activity (Part-4/Part-5) exist, once all four preservation questions have real schemas to answer against — not attempted piecemeal (e.g. "merge Contact/Conversation now, bolt on Deal/Activity later") since a half-built merge that silently drops Deal/Activity references on a later merge would be worse than no merge feature at all.

## What this ADR does not do

No code changes, no merge endpoint, no Contact archive concept. It exists so Customer Merge is scoped as one deliberate piece of work once its prerequisites exist, rather than started early and left half-finished.
