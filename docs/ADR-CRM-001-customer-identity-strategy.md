# CRM-001 — Customer Identity Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-1 recommendation #1)
**Implemented in:** `apps/api/src/modules/crm/{schemas/customer.schema.ts,services/customer.service.ts}`, `apps/api/src/modules/communication/communication.module.ts` (export)

## The boundary

Communication owns `Contact` — the minimal WhatsApp identity record (`workspaceId`, `phoneNumber`, `waProfileName`, `firstSeenAt`/`lastSeenAt`). CRM owns `Customer` — the business relationship record (name, company, GST, address, lifecycle, etc.). This was decided before CRM existed, in ADR-COMM-002 (2026-08-05): _"When CRM is built, it absorbs/references Contact — it does not duplicate phone-number ownership... CRM's Customer schema holds a `contactId` reference."_ PRD-004 Volume-1 §3/§9 confirms this exact shape. This ADR is that decision, now that Customer actually exists: `Customer.contactId` references `Contact` (`SchemaTypes.ObjectId, ref: "Contact"`), and `Customer` never stores WhatsApp-specific metadata (no `waProfileName`, no message/conversation data) — only the CRM business-profile fields PRD-004 §8 lists.

## Every Customer references exactly one Contact, permanently

Enforced structurally, not just by convention: `CustomerSchema` has a unique compound index on `(workspaceId, contactId)` (`customer.schema.ts`) — at most one Customer per Contact per Workspace. `CustomerService.create()` checks this explicitly (`CustomerRepository.findByContactForWorkspace`) before creating, throwing `ConflictException` if a Customer already exists for that Contact — a friendlier error than waiting on the index's own duplicate-key failure, matching the pre-check pattern already established elsewhere in this codebase (e.g. `TeamService`'s duplicate-invitation checks).

## Contact resolution — two creation methods, one mechanism

PRD-004 §11 names two Part-1 creation methods (Method 2 Lead Conversion is Part-3 scope; Method 4 Import is future): Manual Creation and Convert Existing Contact. Both go through the same `POST /crm/customers` endpoint, differentiated by which field `CreateCustomerDto` receives:

- **Manual Creation** (`mobileNumber` supplied) — `CustomerService.create()` calls the exported `ContactRepository.findOrCreate(workspaceId, mobileNumber, null)`, the same method `WebhookService` already uses for inbound messages. If no Contact exists yet for that number, one is created as a side effect; if one already exists, it's reused. Either way, this path is `CustomerSource.MANUAL_ENTRY`.
- **Convert Existing Contact** (`contactId` supplied) — validates the Contact exists in the workspace (`ContactRepository.findByIdForWorkspace`) and uses it directly. This path is `CustomerSource.WHATSAPP`.

If both fields are supplied, `contactId` wins — Method 3 takes precedence (`create-customer.dto.ts`'s own doc comment).

**Why source is method-based, not origin-detected:** a Contact record only ever originates one way in this codebase today — an inbound or outbound WhatsApp message (`ContactRepository.findOrCreate`, called only from `WebhookService`). "Convert an existing Contact" and "this relationship started on WhatsApp" are therefore the same fact, not two independent signals requiring created-vs-found detection logic. Source reflects which method the caller used, not a runtime check of whether `findOrCreate` happened to create or reuse a row.

## Mobile Number is immutable, and why that's not redundant with Contact's own uniqueness

`Customer.mobileNumber` is set once at creation (mirrored from the resolved Contact's `phoneNumber`) and never editable afterward — `UpdateCustomerDto` doesn't declare the field at all, and the global `ValidationPipe`'s `forbidNonWhitelisted: true` rejects any request that tries to include it, rather than silently ignoring it. This isn't just "copy the PRD's immutability rule for `CustomerSource`" — it's the mechanism that keeps the Customer↔Contact link meaningful. If `mobileNumber` could drift from the linked `Contact.phoneNumber`, "which Contact does this Customer represent" and "what's this Customer's phone number" could disagree, and BR-006's mobile-uniqueness-per-workspace rule would no longer be a simple corollary of Contact's own `(workspaceId, phoneNumber)` uniqueness (ADR-COMM-002/BDC-013) — it would need its own independently-maintained constraint.

## What this ADR does not do

No code changes beyond what Part-1 already implements — this documents the identity strategy Part-1 was built against, for Part-2 (Lead Management) and beyond to build on without re-deriving it. Lead's own identity relationship to Contact (if any) is Part-2's own scope, not decided here.
