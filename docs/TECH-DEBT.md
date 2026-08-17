# Technical Debt Register

Living document. Each entry: what the shortcut is, why it was accepted, and what closing it looks like. Not a blocker list — items here are known, deliberate tradeoffs, not defects. Remove an entry only once it's actually resolved (move context to the closing commit/PR, don't just delete the line).

---

## TD-001 — Validation logic duplicated between frontend and backend

**Raised:** 2026-08-04 (Phase-2, Identity & Authentication Module review)
**Status:** Open

**What:** `packages/shared-validation` defines Zod schemas (`emailSchema`, `phoneNumberSchema`, `passwordSchema`, `gstinSchema`) intended as the single source of truth for input validation, consumed today by `apps/web`/`apps/admin` forms. `apps/api`'s NestJS DTOs use `class-validator` decorators instead (the standard pattern for Nest's `ValidationPipe`), so Identity's DTOs (`RegisterDto`, `ResetPasswordDto`, etc.) hand-replicate the same rules (regex, min length) as decorators, with a comment pointing back to `shared-validation` as the canonical source.

**Why accepted for now:** `class-validator` and Zod are different validation libraries with different integration points (`ValidationPipe` vs. `react-hook-form` resolvers) — unifying them isn't a small change, and duplicating a handful of well-tested regexes across two files is a low, well-contained risk as long as both copies are kept in sync deliberately (which the comments in each DTO enforce today).

**Closing this out looks like:** one of —

1. Adopt `nestjs-zod` (or a similar Zod-to-class-validator bridge) so `apps/api` DTOs are generated directly from the `shared-validation` Zod schemas, removing the second copy entirely.
2. Or, if NestJS's own validation ecosystem is preferred long-term, move the canonical rules into `class-validator`-based DTOs in a shared package instead, and have `shared-validation` re-export/wrap them for the frontend.

**Partially addressed (2026-08-10, FRD-001 Volume-2, Authentication & Identity UI):** `passwordSchema` gained `.max(128)` to match the backend's own bound, and a new `PASSWORD_POLICY_RULES` export now drives `PasswordStrengthIndicator`'s live checklist on every password-entry form (`apps/web`'s Reset Password and Change Password). This is the frontend finally consuming the single source of truth `shared-validation` was always meant to be — the schema existed before this volume, just unused by any form. Backend runtime validation remains completely unchanged: `apps/api`'s Identity DTOs still hand-replicate the same rules as `class-validator` decorators, so the actual duplication this entry describes is untouched. No additional Technical Debt is introduced by this volume. See `docs/ADR-FE-003-authentication-ui-strategy.md`, "Shared password validation closes part of TD-001, deliberately not all of it."

**Trigger to revisit:** the next module whose DTOs would duplicate `shared-validation` rules a third time (Workspace's business profile fields, GSTIN validation, etc.) — three independent copies of the same rule is the point this stops being "acceptable duplication" and becomes real drift risk.

---

## TD-002 — E2E test suite requires `--runInBand --forceExit`

**Raised:** 2026-08-04 (Phase-2, Identity & Authentication Module review)
**Status:** Open

**What:** `apps/api`'s e2e Jest config (`test:e2e` script) runs with `--runInBand --forceExit`. Without `--runInBand`, running `health.e2e-spec.ts` and `auth.e2e-spec.ts` in parallel Jest workers produces an intermittent `Unhandled error: Connection is closed` from a BullMQ Worker's underlying ioredis connection during app teardown — two separate NestJS app instances (one per test file), each with its own `EmailModule` BullMQ Worker, connecting to the same Redis instance and closing at slightly different times. `--forceExit` suppresses a separate, non-fatal "Jest did not exit" warning that persists even with `--runInBand` (likely an ioredis/BullMQ handle not fully released on `app.close()`).

**Why accepted for now:** Both flags are inert once applied — no test failures, no masked assertions, just serialized execution and a clean process exit. e2e tests already run against real shared infrastructure (Docker Mongo/Redis), so serializing test _files_ (not test _cases_ within a file) has no real cost at current suite size.

**Closing this out looks like:** root-cause the BullMQ Worker teardown race (likely needs an explicit, awaited `queue.close()`/`worker.close()` sequence beyond what `@nestjs/bullmq`'s `WorkerHost.onModuleDestroy()` does by default, or a Jest `globalTeardown` that tears down one shared Redis connection instead of per-file app instances) and confirm parallel e2e workers run clean with `--detectOpenHandles` showing nothing.

**Trigger to revisit:** before the e2e suite grows large enough that serialized execution becomes a real CI time cost — worth a dedicated infrastructure pass at that point rather than before.

**Update (2026-08-05, Phase-4 Part-1):** now observed even with `--runInBand` — a full 5-suite run occasionally has `health.e2e-spec.ts` fail to start with the same `Connection is closed` error (re-running immediately passes clean). `--runInBand` still eliminates the _parallel_-worker case entirely; this is a residual, lower-frequency variant of the same underlying teardown race, worth folding into the same root-cause pass above rather than treating as a new item — flagged here so an occasional single-suite failure on a full e2e run isn't mistaken for a real regression.

**Update (2026-08-05, Phase-4 Part-2):** `ConversationAutoCloseProcessor` adds a second BullMQ Worker (`conversation-auto-close`) alongside the existing webhook-processing one, each new e2e app instance registering its own repeatable job on `onModuleInit`. This is one more Worker/Redis connection pair per test-file app instance, plausibly increasing the surface for the same teardown race rather than fixing it — worth re-checking whether this queue's presence changes the flake frequency once the root-cause pass above happens.

---

## TD-003 — Conversation auto-close inactivity threshold is a fixed platform-wide constant

**Raised:** 2026-08-05 (Phase-4 Part-2, Shared Inbox & Conversation Management)
**Status:** Open

**What:** `CONVERSATION_AUTO_CLOSE_HOURS` (`apps/api/src/modules/communication/communication.constants.ts`) is a fixed constant (24 hours), applied identically to every workspace. The original module scope (per the Business Decision Log's PRD-003 Part 2 review notes) described this as a "configurable duration," implying a per-workspace setting.

**Why accepted for now:** Building a per-workspace setting means extending the Workspace module's schema/settings surface (a different, already-reviewed-and-approved module) purely to support a Communication-owned behavior — a bigger cross-module change than Part-2's scope warranted. A single sensible default ships the actual auto-close _behavior_ (the real business requirement) without that expansion.

**Closing this out looks like:** add a `conversationAutoCloseHours` (or similar) field to Workspace's settings, have `ConversationAutoCloseProcessor`/`ConversationService.autoCloseInactive()` read it per-workspace instead of the shared constant, defaulting to 24 for workspaces that haven't set one.

**Trigger to revisit:** first real customer request for a different auto-close window, or when Settings (PRD-006) is built and workspace-level configuration surfaces already exist to hang this off of.

---

## TD-004 — Auto Assignment has no real agent presence/availability signal

**Raised:** 2026-08-05 (Phase-4 Part 4b, Automation Engine — Auto Assignment)
**Status:** Open

**What:** `AutoAssignmentService`'s eligible pool (`docs/COMM-AUTO-ASSIGNMENT.md`) is every workspace member with `workspaceMemberStatus: ACTIVE` holding `SALES_EXECUTIVE`/`SUPPORT_EXECUTIVE` — there is no online/offline, away, or heartbeat concept anywhere in Identity or Workspace today, so Round Robin and Least Active Agent both treat every eligible agent as available regardless of whether they're actually at their desk. An agent who is ACTIVE but on leave (or simply not logged in) is just as eligible as one actively working.

**Why accepted for now:** Building real presence (a heartbeat/session-liveness signal, or a manual online/offline toggle with its own endpoint and UI) is genuinely new scope — it was explicitly considered and deferred during Part 4b's doubt-policy scoping (the confirmed decision: "All ACTIVE members in agent roles," not a new availability toggle) rather than an oversight. Membership-status-based eligibility ships the real behavior (automatic routing, load-aware for Least Active) without that expansion.

**Closing this out looks like:** add a presence signal (simplest: a manual `isAvailableForAssignment` boolean agents toggle themselves, with its own PATCH endpoint; more complete: a session-liveness heartbeat) and have `UserRepository.findByWorkspaceRolesActive` (or a new query) filter on it in addition to `workspaceMemberStatus`.

**Trigger to revisit:** first real customer complaint about a Conversation auto-assigned to an agent who isn't actually working, or when Auto Assignment's usage data shows this materially skewing load away from Least Active Agent's intent.

---

## TD-005 — SLA response threshold is a fixed, non-business-hours-aware constant

**Raised:** 2026-08-06 (Phase-4 Part 4c, Automation Engine — SLA Monitoring & Escalation Rules)
**Status:** Open

**What:** `SLA_RESPONSE_HOURS` (`apps/api/src/modules/communication/communication.constants.ts`, currently 4) is a fixed, platform-wide, flat wall-clock duration — it does not consult `Workspace.businessHours` (Phase-3) at all. A Conversation left unanswered overnight or over a weekend accrues toward the same 4-hour breach threshold as one left unanswered during business hours, even though no agent could reasonably have been expected to reply outside working hours.

**Why accepted for now:** Making the SLA clock business-hours-aware means computing elapsed _business_ time between two timestamps (skipping closed hours/days/holidays) rather than a simple `Date` subtraction — meaningfully more complex than `isWithinBusinessHours()`'s existing point-in-time check (`business-hours.util.ts`), which only answers "is this one instant open or closed," not "how much open time elapsed between two instants." Same reasoning `CONVERSATION_AUTO_CLOSE_HOURS` (TD-003) and `AUTO_REPLY_COOLDOWN_HOURS` already accepted for this codebase's automation timers: a flat constant ships the real behavior (escalation happens) without that added complexity, and is a known, deliberate simplification rather than an oversight.

**Closing this out looks like:** either (a) a business-hours-aware elapsed-time function (`business-hours.util.ts` would need a new `businessHoursElapsed(businessHours, from, to)` alongside its existing `isWithinBusinessHours`), used by `findSlaBreachCandidates`'s cutoff calculation instead of a flat `Date` subtraction, or (b) a simpler interim step — excluding weekends/closed days from the sweep's candidate query without full sub-day precision — if full business-hours accuracy isn't needed immediately. Per-workspace-configurable `SLA_RESPONSE_HOURS` (vs. today's platform-wide constant) is the same category of change as TD-003 and can close alongside it.

**Trigger to revisit:** first real customer complaint about an overnight/weekend escalation firing when no agent could have responded in time, or when Settings (PRD-006) is built and workspace-level configuration surfaces already exist to hang a per-workspace threshold off of.

---

## TD-006 — Customer list/search doesn't support sorting by Last Conversation

**Raised:** 2026-08-06 (Phase-5 Part-1, CRM — Customer Management)
**Status:** Open

**What:** PRD-004 Volume-1 §14 lists five sortable fields for the Customer list: Name, Created Date, Last Updated, Last Conversation, Company. `CustomerRepository.list()` (`apps/api/src/modules/crm/repositories/customer.repository.ts`) implements four of the five — `customerName`, `createdAt`, `updatedAt`, `companyName` — all genuine fields on the `Customer` document itself. "Last Conversation" is not implemented.

**Why accepted for now:** "Last Conversation" isn't a `Customer` field at all — it lives on Communication's `Conversation.lastMessageAt`, joined by `contactId`. Sorting by it means either a MongoDB `$lookup` aggregation (a query shape nothing in this codebase uses yet — every other list/sort endpoint sorts on fields native to its own collection) or denormalizing a `lastConversationAt` copy onto `Customer` and keeping it in sync from Communication events, which is real new cross-module wiring beyond what Part-1's approved scope needs. The other four sort fields ship the real capability (sorting a Customer list at all) without that complexity.

**Closing this out looks like:** either (a) add an aggregation pipeline to `CustomerRepository.list()` that `$lookup`s the linked Contact's Conversation and sorts on `lastMessageAt`, or (b) subscribe to Communication's message/conversation domain events (`MESSAGE_RECEIVED`/`MESSAGE_SENT`, already emitted) and denormalize `Customer.lastConversationAt`, updated on each event — consistent with this codebase's event-driven cross-module pattern (`docs/ADR-EVENTS-001-domain-event-strategy.md`) rather than a live join.

**Trigger to revisit:** first real product request for this specific sort option, or when CRM Reports & Dashboard (Part-6) needs conversation-recency data anyway and the same underlying wiring can serve both.

---

## TD-007 — Lead assignment doesn't validate assignee id format before querying

**Raised:** 2026-08-07 (Phase-5 Part-4, CRM — Deal Management review; formally tracked 2026-08-07 per Architecture Review)
**Status:** Open

**What:** `LeadService.assign()` (`apps/api/src/modules/crm/services/lead.service.ts`) passes `assignedUserId` straight to `UserRepository.findById()` without checking it's a well-formed Mongo ObjectId first. A malformed id (not 12 bytes / not a 24-character hex string) makes the underlying `findOne({ _id: id, ... })` query throw an uncaught Mongoose `CastError`, which the global `HttpExceptionFilter` treats as an unexpected exception — a 500 Internal Server Error instead of a clean 400 Bad Request. `DealService.assign()` has the identical `userRepository.findById(assignedTo)` call shape and was fixed with an explicit `Types.ObjectId.isValid()` guard during Part-4's e2e verification (the first time this call shape was actually exercised with a malformed id).

**Why accepted for now:** Lead Management (Part-2) is already reviewed, approved, and frozen — per this project's frozen-module policy, functional changes to it are made only via a new approved enhancement or bug fix, not folded silently into an unrelated Part's work. The fix itself is small and well-understood (mirror Deal's guard exactly), so there's no design uncertainty blocking it — just the policy of not touching frozen code opportunistically.

**Closing this out looks like:** add the same `if (!Types.ObjectId.isValid(assignedUserId)) throw new BadRequestException(...)` guard to `LeadService.assign()`, immediately before the existing `userRepository.findById()` call — copy `DealService.assign()`'s guard verbatim, then add a matching unit test (`rejects a malformed assignee id without querying the database`) and confirm `lead.service.spec.ts`/`lead.e2e-spec.ts` still pass.

**Trigger to revisit:** the next approved maintenance/bug-fix pass over Lead Management, or sooner if a malformed-id 500 is ever actually observed in practice (client bug, direct API misuse, etc.).

---

## TD-008 — Activity search/filter doesn't cover Customer/Deal name or Assigned User name

**Raised:** 2026-08-07 (Phase-5 Part-5, CRM — Activities, Tasks, Follow-ups & Notes)
**Status:** Open

**What:** PRD-004 Volume-5 §12 lists Customer, Deal, and Assigned User as searchable fields alongside Title/Notes. `ActivityRepository.list()`'s `q` filter (`apps/api/src/modules/crm/repositories/activity.repository.ts`) only searches `title`/`description`/`text` — fields native to the `activities` collection itself. Searching by the linked Customer's name, Deal's title, or the assignee's full name would match against a _different_ collection's field.

**Why accepted for now:** Same reasoning as TD-006 (Customer's deferred "Last Conversation" sort): matching a cross-collection field means either a `$lookup` aggregation (a query shape nothing in this codebase's list/search endpoints uses yet) or denormalizing a display-name copy onto `Activity` and keeping it in sync via domain events. Title/Description/Note-text search ships the real capability (finding an Activity by its own content) without that added complexity.

**Closing this out looks like:** either (a) add a `$lookup`-based aggregation to `ActivityRepository.list()` joining `customers`/`deals`/`users` for name matching, or (b) denormalize `customerName`/`dealTitle`/`assignedUserName` onto `Activity` at write time (creation, assignment, and whenever the linked Customer/Deal is renamed — the last part needing new event subscriptions this module doesn't have yet).

**Trigger to revisit:** first real product request for searching Activities by Customer/Deal/Assignee name, or when CRM Reports & Dashboard (Part-6) needs the same cross-collection joins anyway.

---

## TD-009 — Plan pricing (monthlyPrice/yearlyPrice) is null pending GTM pricing approval

**Raised:** 2026-08-07 (Phase-6 Part-1, Billing — Subscription & Plans)
**Status:** Open

**What:** The three approved Plan tiers (Starter/Growth/Enterprise) are seeded on boot (`PlanService.onModuleInit`) with real names but `monthlyPrice`/`yearlyPrice` left `null`. Commercial pricing has not been formally approved via a GTM pricing decision as of this writing.

**Why accepted for now:** Explicit instruction: do not persist an invented or unapproved commercial value — including `0`, which has its own real meaning ("free plan"), not "unset." Leaving the fields `null` (schema allows it) makes the pending-approval state visible and unambiguous rather than silently wrong.

**Closing this out looks like:** once the GTM pricing decision is formally approved, set the real `monthlyPrice`/`yearlyPrice` for all three Plan documents — a direct database update or a small one-off seed-correction script is sufficient, since `§15`'s API surface has no Plan-mutation endpoint (`GET /billing/plans` is read-only) for this to interact with.

**Trigger to revisit:** GTM pricing approval, required before production deployment.

---

## TD-010 — Platform Billing Operations have no dedicated platform-operator role yet

**Raised:** 2026-08-07 (Phase-6 Part-2, Billing — Invoices & Payments; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Closed (2026-08-08, Phase-8 Part-2 — PRD-007 Volume-2, Platform Billing Operations & Customer Support)

**What:** `POST /billing/payments` and `POST /billing/refunds` (`apps/api/src/modules/billing/controllers/payment.controller.ts`) are manual recording actions — Payment Gateway Integration is §14 Out of Scope, so there is no real gateway to independently verify a claimed payment. Resolved during Architecture Review that these should be platform-operator-only, but no such concept exists anywhere in `apps/api` yet: `PlatformRole` (`packages/shared-types/src/enums/role.enum.ts`) is pre-scaffolded with `PLATFORM_SUPER_ADMIN`/`PLATFORM_SUPPORT_MANAGER`/`PLATFORM_SUPPORT_EXECUTIVE`, but has zero live consumers — no `User.platformRole` field, no guard, nothing wired (Platform Administration is PRD-007, a later, unbuilt module). "Platform Billing Executive" was explicitly removed from that enum for Phase-1 per its own code comment (ADR-036), confirming this gap was already anticipated and deliberately deferred at the planning stage, not an oversight now.

**Why accepted for now:** Wiring `PlatformRole` up (a `User.platformRole` field, a new guard, a new controller-level check) is Platform Administration module scope, not Volume-2's — implementing a slice of an unreviewed, unapproved future module inside this one would be exactly the kind of scope creep the phase-discipline process exists to prevent. As an interim, narrower-than-nothing measure, both endpoints require `TenantRole.OWNER` specifically (`PaymentController.ensureOwner()`) — tighter than `BILLING_ACCESS` alone would allow (`PermissionsGuard` is binary NONE-vs-not-NONE, so `BILLING_ACCESS` alone would also let Administrator's `VIEW_ONLY` through), but still a Workspace-side role standing in for a genuine platform-side one.

**How this was actually closed:** not by modifying the tenant `TenantRole.OWNER` check this entry originally proposed — by the time Platform Administration existed (ADR-PLAT-002), Platform and Identity turned out to be two completely separate, non-intersecting identity/auth/guard systems (`PlatformAuthGuard`/`PlatformPermissionsGuard` operate on `AuthenticatedPlatformUser`, never `AuthenticatedUser`), so "gate the tenant endpoint behind a platform role" was never physically reachable in the architecture that actually got built. The real closure is new, parallel platform-side endpoints — `POST /platform/payments/manual` and `POST /platform/payments/:id/refund` (`apps/api/src/modules/platform/controllers/platform-payments.controller.ts`), gated by `PlatformPermission.MANAGE_PAYMENTS` (`PLATFORM_SUPER_ADMIN`-only) — that delegate straight into the same `PaymentService.record()`/`refund()` this entry describes (BR-006, no duplicate logic). `POST /billing/payments`/`POST /billing/refunds` and their `TenantRole.OWNER` check are untouched and remain the tenant Owner's own self-service path; the two are now deliberately parallel, not one replacing the other. See docs/ADR-PLAT-003-platform-billing-operations-boundary.md.

---

## TD-011 — Invoice amount/tax are null pending the same commercial approvals as Plan pricing

**Raised:** 2026-08-07 (Phase-6 Part-2, Billing — Invoices & Payments)
**Status:** Open

**What:** `InvoiceService.generateForSubscriptionUpgrade()` (`apps/api/src/modules/billing/services/invoice.service.ts`) computes `Invoice.amount` from `Plan.monthlyPrice`/`yearlyPrice` — both currently `null` (TD-009) — and leaves `Invoice.tax` `null` unconditionally, since no tax-rate configuration (e.g. a GST percentage) exists anywhere in this codebase yet. Every Invoice generated today is therefore created with `amount: null, tax: null`.

**Why accepted for now:** Direct consequence of TD-009, plus the same standing instruction applied a second time: do not persist an invented or unapproved commercial value, including `0` — a tax rate of `0` reads as "tax-exempt," a real business assertion, not "not yet configured." Computing `amount` from `Plan` (rather than hardcoding a separate copy) means GTM pricing approval alone is enough to make future-generated Invoices carry a real `amount`, with no code change here.

**Closing this out looks like:** once GTM pricing is approved (closes TD-009), newly generated Invoices will automatically carry a real `amount` — no action needed in this module. `tax` needs its own, separate resolution: a formally approved tax-rate source (a fixed platform-wide GST percentage, or a more elaborate per-state/per-plan rule) has to be designed and approved before `InvoiceService` can compute anything but `null` for it.

**Trigger to revisit:** GTM pricing approval (for `amount`, shared with TD-009) and a formally approved tax-rate decision (for `tax`) — required before production deployment.

---

## TD-012 — Payment Gateway Integration (webhooks, reconciliation, retries, signature verification, idempotency)

**Raised:** 2026-08-07 (Phase-6 Part-2, Billing — Invoices & Payments; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** PRD-005 Volume-2 §14 explicitly excludes Payment Gateway Integration from scope. As a direct consequence, none of the following exist anywhere in `apps/api`'s Billing module: a real payment gateway client, webhook/callback endpoints, signature verification for inbound gateway callbacks, idempotency handling for retried/duplicate webhook deliveries, automatic payment retry, or reconciliation (matching the platform's own Payment records against a gateway's transaction history). `PaymentService.record()` is entirely manual — every Payment is created and resolved to its final outcome in one synchronous call by whoever is recording it (see `docs/ADR-BILL-004-invoice-payment-relationship.md`), which is the interim mechanism this Tech Debt entry brackets.

**Why accepted for now:** Explicitly out of scope per the relayed PRD-005 Volume-2 document itself (§14) — building any of this now would be implementing a slice of an unreviewed, unapproved future volume, the same reasoning already applied to TD-010 (Platform Billing Operations). Manual recording ships the real underlying capability (Invoices get marked paid, Refunds get tracked) without requiring gateway credentials, webhook infrastructure, or signature-verification logic that doesn't have an approved design yet.

**Closing this out looks like:** a dedicated Payment Integration volume/phase that adds: a real gateway client (e.g. an India-market payment gateway, once a vendor decision is formally approved), inbound webhook endpoints with signature verification, idempotency keys so a retried webhook delivery never double-processes the same event, automatic retry logic for failed charges (§14's "Auto Retry" exclusion), and a reconciliation job comparing Payment records against the gateway's own transaction ledger. `PaymentService.record()`'s manual path likely stays as an operator override/fallback even after this lands, rather than being removed outright.

**Trigger to revisit:** Payment Integration volume/phase planning and approval — the natural next Billing volume once a payment gateway vendor decision has been made.

---

## TD-013 — Deferred commercial counters: Campaigns, Storage, API Requests

**Raised:** 2026-08-07 (Phase-6 Part-3, Billing — Usage, Limits & Enforcement; formally tracked as a Governance Recommendation per Architecture Review, extended during implementation)
**Status:** Open

**What:** §6 lists 9 usage counters. `UsageCounterListener` (`apps/api/src/modules/billing/listeners/usage-counter.listener.ts`) wires 6 of them to a real creation-time domain event. Three have no viable data source today and are not counted at all (`WorkspaceUsage.{campaignsCount,storageCount,apiRequestsCount}` stay `0` forever):

- **Storage** — file uploads bypass the API entirely; the client uploads directly to Cloudinary using a signature `StorageService` issues (`apps/api/src/infrastructure/storage/storage.service.ts`, SEC-016). The backend has no visibility into whether an upload happened or how large it was.
- **API Requests** — the only existing request-counting infrastructure is `ThrottlerModule` (`app.module.ts`, SEC-009), a technical, platform-wide, per-route rate limiter unrelated to a per-workspace commercial counter.
- **Campaigns** (identified during implementation, not in the original Architecture Review's two named counters) — Communication's domain event catalog (`apps/api/src/common/events/domain-events.ts`) has `CAMPAIGN_COMPLETED`/`CAMPAIGN_CANCELLED` but no `CAMPAIGN_CREATED`/`CAMPAIGN_STARTED` — there is no creation-time event to hook, the same shape of gap as the other two.

**Why accepted for now:** Resolved during Architecture Review for Storage/API Requests, and the same reasoning extends cleanly to Campaigns once it surfaced: each would require new infrastructure or a new event in an already-frozen module (Communication, Phase-4) that Volume-3 has no mandate to modify. `PlanLimits`/`WorkspaceUsage` both declare fields for all 9 counters (schema completeness, matching how `Plan.monthlyPrice` stayed a real field while null pending approval) so no future migration is needed once each is closed — only a new event source and a new listener handler.

**Closing this out looks like:** per counter — Campaigns needs a new `CAMPAIGN_CREATED`/`CAMPAIGN_STARTED` event added to Communication's catalog (a small, additive change, not a redesign) plus a new `UsageCounterListener` handler; Storage needs a Cloudinary webhook (or periodic reconciliation against Cloudinary's own API) to attribute and size uploads per workspace; API Requests needs a new global interceptor tracking authenticated requests per workspace, distinct from the existing technical rate limiter.

**Trigger to revisit:** first real need to enforce any of these three specifically, or a maintenance pass over Communication that's already touching campaign creation for another reason.

---

## TD-014 — Plan usage limits (teamMembersLimit, customersLimit, etc.) are null pending commercial approval

**Raised:** 2026-08-07 (Phase-6 Part-3, Billing — Usage, Limits & Enforcement)
**Status:** Open

**What:** `PlanLimitsService.onModuleInit()` (`apps/api/src/modules/billing/services/plan-limits.service.ts`) seeds one `PlanLimits` document per Plan (Starter/Growth/Enterprise) with all entitlement flags `true` and every numeric limit field (`teamMembersLimit`, `customersLimit`, `leadsLimit`, `dealsLimit`, `broadcastsLimit`, `campaignsLimit`, `messagesLimit`, `storageLimit`, `apiRequestsLimit`) `null`.

**Why accepted for now:** Same discipline already applied to `Plan.monthlyPrice`/`yearlyPrice` (TD-009) and `Invoice.amount`/`tax` (TD-011): a specific number like "10 Team Members" or "500 Customers" is exactly as much an unapproved commercial decision as a price — it differentiates what a customer gets for what they pay — and persisting an invented figure (including treating `null` as if it silently meant "unlimited" without that being an actual approved decision) would be exactly the unapproved-commercial-value problem the standing instruction exists to prevent. `null` here means "not yet approved," and reads identically to "unlimited" from every consumer's perspective (`UsageService.checkLimit`/`recordCreation` both treat a `null` limit as nothing to enforce or warn about) — which is the correct behavior either way until real numbers are approved.

**Closing this out looks like:** once GTM/product limits are formally approved per Plan, set the real numeric values on each Plan's `PlanLimits` document — a direct database update or a small one-off seed-correction script, mirroring how TD-009 expects to close (no Plan-limits-mutation endpoint exists for this to interact with, §13 is read-only).

**Trigger to revisit:** commercial usage-limit approval per Plan tier, required before production deployment — the moment this closes, `USAGE_THRESHOLD_REACHED`/`USAGE_LIMIT_EXCEEDED`/`WORKSPACE_LOCKED` all become live for the first time (they're wired correctly today but dormant, since nothing can cross a `null` limit).

---

## TD-015 — Enforcement Retrofit Program (CRM, Communication, Workspace)

**Raised:** 2026-08-07 (Phase-6 Part-3, Billing — Usage, Limits & Enforcement; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** `UsageService.checkLimit()`/`checkFeatureEnabled()` (`apps/api/src/modules/billing/services/usage.service.ts`) exist and are exported from `BillingModule`, but nothing in this codebase calls them. §4's "Business modules shall never bypass Usage enforcement" is not yet true anywhere — CRM's `CustomerService`/`LeadService`/`DealService`, Communication's `BroadcastService`/`CampaignService`, and Workspace's `TeamService` (invite) all create resources today with zero Usage check in the path.

**Why accepted for now:** Resolved 2026-08-07, Architecture Review: retrofitting already-frozen CRM (Phase-5) and Communication (Phase-4) mutation paths is out of Volume-3's own scope — the same frozen-module discipline already applied to TD-007. Volume-3's job was building the engine (counters, entitlements, evaluation) and the reusable check methods; wiring each business module to actually call them is real, non-trivial, per-module work (see `docs/ADR-BILL-009-usage-enforcement-evolution.md` for the integration pattern) that deserves its own review, not a silent addition to an unrelated Part.

**Closing this out looks like:** for each of CRM/Communication/Workspace, individually: import `BillingModule`, inject `UsageService`, add a pre-flight `checkLimit`/`checkFeatureEnabled` call (guard-based for simple one-counter checks, inline for composite ones like Broadcast-consumes-N-Messages) immediately before the existing creation logic, fail-closed on a Usage-service error. Counting itself needs no change — `UsageCounterListener` already increments reactively off the same domain events these services already emit.

**Trigger to revisit:** each business module's own next approved maintenance/enhancement pass, individually — not a single big-bang retrofit. Loosely gated by TD-014 (commercial limits are still null, so enforcement has no observable effect until real numbers are approved) — TD-014 closing is a natural prioritization trigger for this, though not a strict prerequisite.

---

## TD-016 — Reporting Performance Strategy (caching, materialized views, scheduled snapshots, background exports)

**Raised:** 2026-08-07 (Phase-6 Part-4, Billing — Reports & Administration; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** `BillingReportsService`/`BillingReportsRepository` (`apps/api/src/modules/billing/services/billing-reports.service.ts`, `apps/api/src/modules/billing/repositories/billing-reports.repository.ts`) run a live MongoDB aggregation on every request — no caching layer, no materialized view, no scheduled snapshot job, and `GET /billing/reports/export` (CSV/Excel) generates its file synchronously within the request/response cycle rather than as a background job.

**Why accepted for now:** Explicit business rule (§Business Rules — "Reports never cache commercial data... Reports always calculate from current state") and the same deliberate simplicity-first choice already made for CRM Reports (`docs/ADR-CRM-019-crm-reporting-strategy.md`) — a live aggregation is correct and fast enough at current (pre-launch, low-data-volume) scale, and avoids the real complexity of cache invalidation across Subscription/Invoice/Payment/Usage's independently-changing collections.

**Closing this out looks like:** once real usage data volume makes live aggregation noticeably slow, one or more of: (a) a short-TTL cache in front of the dashboard specifically (the most frequently hit, least time-sensitive endpoint), (b) a scheduled job that periodically materializes expensive aggregations (e.g. `monthlyRevenueBreakdown`) into their own collection, refreshed on a timer rather than every request, or (c) moving CSV/Excel export generation to a background job (BullMQ, same infrastructure already used for `SubscriptionLifecycleProcessor`/`InvoiceLifecycleProcessor`) with the client polling or receiving a download link once ready, for exports large enough that synchronous generation risks a request timeout.

**Trigger to revisit:** first real, measured latency complaint about any Billing Reports endpoint, or when Billing History/Usage History (both append-only, unbounded-growth collections) reach a size where their own aggregations noticeably slow down.

---

## TD-017 — Localization Strategy (editable language selection, translation resources, locale management)

**Raised:** 2026-08-07 (Phase-7 Part-1, Settings — Workspace Settings; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** `Workspace.language` (`apps/api/src/modules/workspace/schemas/workspace.schema.ts`) remains fixed at `"en"` with no selector — `SettingsOverview.language` (`apps/api/src/modules/settings/`) surfaces the current value for Settings' unified read view, but no endpoint exists anywhere to change it. No translation resources, no locale-aware formatting, no i18n infrastructure exists in this codebase.

**Why accepted for now:** `Workspace.language`'s own existing code comment (`ADR-027`) explains the field was deliberately added early so that enabling a real selector later would be "an additive change, not a schema migration" — it anticipated this moment without confirming Volume-1 (Workspace Settings) was the intended trigger. Resolved 2026-08-07, Architecture Review: real localization (translated UI/content, not just a stored preference string) is a meaningfully bigger effort than one Settings field, and deserves its own dedicated planning/review rather than being folded into Workspace Settings almost incidentally.

**Closing this out looks like:** a dedicated Localization/i18n initiative that adds: a real `PATCH` endpoint to change `Workspace.language` away from `"en"`, translation resource files/tooling for the supported language set (already named in `ADR-027`'s own comment: Hindi/Gujarati/Marathi/Tamil/Telugu/Kannada/Malayalam), locale-aware date/number formatting (which may end up related to — but is distinct from — Settings' own `dateFormat`/`timeFormat` display preferences), and a decision on whether changing language affects existing data (a question §6 of PRD-006 Volume-1 itself already flagged and explicitly deferred).

**Trigger to revisit:** Localization/i18n initiative planning and approval — the natural moment `ADR-027`'s own anticipated "additive change" actually happens.

---

## TD-018 — Future MFA Configuration (2FA, passkeys, trusted devices, recovery codes, authenticator apps)

**Raised:** 2026-08-08 (Phase-7 Part-2, Settings — User Preferences & Security Settings; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** §4.8 (Security Preferences) names Two-Factor Authentication, Recovery Codes, Trusted Devices, Passkeys, and Authenticator Apps as "Future Ready" — explicitly "Read Only. Not Configurable" for this volume. None of these exist anywhere in Identity today: `User` has no MFA-related fields (no `mfaEnabled`, `mfaSecret`, recovery codes, trusted-device list, or passkey credentials), and no endpoint surfaces even a read-only stub for any of them — consistent with §4.8's own scope limit and §13's literal API surface, which lists no route for this section at all.

**Why accepted for now:** Explicitly out of scope per the relayed PRD-006 Volume-2 document itself (§4.8/§10) — building any of this now would be implementing a slice of a future, unapproved capability, the same reasoning already applied to TD-012 (Payment Gateway Integration) and TD-013 (deferred Usage counters). §4.8 frames this section as forward-looking scaffolding for the _concept_, not a request to build even a stub this volume.

**Closing this out looks like:** a dedicated MFA/Security initiative that adds, to Identity: TOTP-based Two-Factor Authentication (secret generation, QR enrollment, verification on login), single-use Recovery Codes, a Trusted Devices list (skip 2FA on remembered devices), WebAuthn/Passkey support, and Authenticator App enrollment — each surfaced through Settings the same way Password/Sessions/Login History are in this volume (thin orchestration, Identity remains sole owner, `docs/ADR-SET-004-identity-orchestration-strategy.md`'s pattern extends directly).

**Trigger to revisit:** MFA/Security initiative planning and approval — likely prioritized by a real customer security requirement (enterprise SSO/compliance ask) rather than a fixed date.

---

## TD-019 — OAuth Integration Initiative (Google, Microsoft, Slack, Zoom connections)

**Raised:** 2026-08-08 (Phase-7 Part-3, Settings — Integrations & External Services; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** PRD-006 Volume-3 §4.5 (OAuth Connections) proposed workspace-level connections to Google, Microsoft, Slack, and Zoom — Settings storing connection metadata (provider/connected user/connected at/status), Identity owning the actual OAuth2 token exchange and refresh-token handling (the same ownership split §4.4 gives API Keys and this volume's own ADR-SET-005 confirms). None of it was built this volume: no OAuth login, connection flow, provider SDK, or token-exchange code exists anywhere in Identity.

**Why accepted for now:** Resolved 2026-08-08, Architecture Review: Identity has zero existing OAuth infrastructure to extend (unlike API Keys, which could reuse `PasswordService`'s established bcrypt pattern, or WhatsApp lifecycle actions, which could reuse the already-working `MetaApiClient`). Four full OAuth2 client integrations, each with its own provider quirks (token refresh, scope negotiation, revocation), is realistically its own multi-week initiative — bundling it into a volume already covering WhatsApp lifecycle actions, Email config, Webhooks (config + delivery pipeline), API Keys, and Third-party App toggles would have meaningfully increased this volume's defect surface for a capability nothing else in Volume-3 depends on.

**Closing this out looks like:** a dedicated OAuth Integrations initiative that adds, to Identity: OAuth2 client flows for Google/Microsoft/Slack/Zoom (authorization-code exchange, refresh-token storage via `TokenEncryptionService` — reversible, same reasoning as the WABA access token — never bcrypt), and to Settings: an `OAuthConnectionsController`/service exposing connect/status/disconnect, orchestrating Identity's token handling the same thin-proxy shape `WhatsAppIntegrationService`/`SecuritySettingsService` already establish. §9's `GET /settings/oauth`, `POST /settings/oauth/connect`, `DELETE /settings/oauth/:provider` endpoints were never implemented — they belong to this initiative, not retrofitted onto Volume-3's existing controllers.

**Trigger to revisit:** OAuth Integrations initiative planning and approval — the natural moment a concrete need for one of these four providers (e.g. a specific customer requesting Slack notifications or Google Calendar sync) makes the build cost worth it.

---

## TD-020 — Audit Storage Strategy (retention, indexing, partitioning, archival)

**Raised:** 2026-08-08 (Phase-7 Part-4, Settings — Audit Logs, Data Management & System Administration; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** `audit_log_entries` (`apps/api/src/modules/settings/schemas/audit-log-entry.schema.ts`) is a new, write-amplifying collection — every covered domain event (20 today, see `docs/ADR-SET-007-audit-strategy.md`) now also writes an audit row, in addition to whatever the emitting module itself persists. A compound `(workspaceId, createdAt)` index exists from day one, and `RetentionPolicy`'s configurable `auditLogRetentionDays` (§4.4, 30-3650 days) plus the hourly `RetentionCleanupProcessor` sweep are the only caps on this collection's growth. No caching, no read replicas, no partitioning/sharding strategy, and no archival-before-delete path (expired entries are hard-deleted by the retention sweep, not moved to cold storage) exist yet.

**Why accepted for now:** This is a brand-new collection with zero production data — premature to design partitioning/archival/caching for a write volume that hasn't been observed yet. The retention sweep (a real, working deletion mechanism, not a stub) is the one piece that couldn't be deferred, since BR-007 ("retention policies affect future cleanup only") is an explicit business rule from the relayed document itself, not an optimization.

**Closing this out looks like:** once real usage data exists, revisit (a) whether `audit_log_entries` needs time-based partitioning or a separate cold-storage tier for entries past some age but not yet past their retention cutoff, (b) whether high-traffic workspaces need audit writes queued/batched rather than synchronous per-event inserts (mirroring the already-queued webhook delivery pattern), and (c) whether an archival export (not just deletion) should happen automatically when the retention sweep would otherwise hard-delete entries, for workspaces that want a permanent record outside the platform.

**Trigger to revisit:** a real, measured write-latency or storage-growth concern on `audit_log_entries` specifically, or a customer request for audit data retention beyond what deletion-only cleanup supports (i.e., they want an archive, not just a longer `auditLogRetentionDays`).

---

## TD-021 — Cross-Tenant Support Access (Break-Glass, Support Sessions, cross-tenant CRM/Billing search)

**Raised:** 2026-08-08 (Phase-8 Part-1, Platform Administration & Tenant Management, PRD-007 Volume-1; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Closed (2026-08-10, Phase-8 Part-3 — PRD-007 Volume-3, Platform Support, Break-Glass Access & Global Audit)

**What:** PRD-007 Volume-1 §12 confirms Break-Glass Access (a Platform Administrator temporarily impersonating or directly viewing inside a specific tenant's data — Customers, Leads, Deals, Conversations, Invoices) and Support Sessions (a scoped, audited, time-boxed version of the same) as explicitly out of scope for this volume, alongside cross-tenant CRM/Billing search (searching _inside_ tenant business data, not just the Workspace/User registry-level search this volume built). Nothing resembling any of this exists today: `PlatformPermission` has no `MANAGE_SUPPORT_ACCESS`/`VIEW_TENANT_DATA`-shaped permission, no session type exists that carries "acting as Platform Administrator, viewing tenant X's data," and Workspace Search (§4.6, this volume) deliberately stops at Workspace name and User name/email — it was never extended to reach into `CustomerRepository`/`LeadRepository`/`InvoiceRepository` (see `docs/ADR-PLAT-001-platform-administration-boundary.md`, "Cross-tenant reads are new; they're deliberately narrow").

**Why accepted for now:** Resolved 2026-08-08, Architecture Review, matching the Approved Architecture Decisions' own explicit Out of Scope list. Break-Glass Access in particular is a materially higher-stakes capability than anything else in this volume — it means a Platform Administrator can see real customer PII (contact details, conversation content, invoice/payment history) belonging to a tenant who never granted that access directly, which needs its own dedicated security review (audit trail granularity, consent/notification requirements, time-boxing, and likely a legal/compliance sign-off) rather than being folded into a volume whose other seven features are all either registry-level (Workspace/User) or aggregate-level (Dashboard counts, revenue totals) — none of which expose a single tenant's underlying business record content.

**How this was actually closed:** PRD-007 Volume-3 built the genuinely audited Support Session concept this entry called for — `SupportSession` (`apps/api/src/modules/platform/schemas/support-session.schema.ts`) carries request/approve/start/end timestamps, `startedBy` (the session-holder, distinct from `requestedBy` — see ADR-PLAT-005), a mandatory `reason`, and a hard `expiresAt` capped at 240 minutes (§10), enforced both by a periodic sweep and a real-time check at every gated read. `REQUEST_SUPPORT_ACCESS`/`APPROVE_SUPPORT_ACCESS`/`START_SUPPORT_SESSION` are a dedicated `PlatformPermission` tier, separate from every other Platform permission exactly as this entry specified, with Approve/Start restricted to `PLATFORM_SUPER_ADMIN`. What was **not** closed: cross-tenant CRM/Billing _search_ and any write-capable/true-Impersonation surface remain unbuilt — §9's literal route table for this volume has zero write routes and zero CRM-search routes (see ADR-PLAT-005, "Read-only, not Impersonation"). Volume-3 resolved the read-only, audited half of this entry; the write-capable half is re-opened below as TD-023, since it carries a distinct legal/compliance/notification surface this volume's document never addressed.

**Trigger that closed it:** PRD-007 Volume-3 was relayed, reviewed, and approved (2026-08-10) as the dedicated Cross-Tenant Support Access initiative this entry asked for.

---

## TD-022 — Invoice Regenerate/Reissue (deferred, PRD-007 Volume-2)

**Raised:** 2026-08-08 (Phase-8 Part-2, Platform Billing Operations & Customer Support, PRD-007 Volume-2; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** PRD-007 Volume-2 §4.2 names "Regenerate Invoice" and "Reissue Invoice" as things a platform operator may do, alongside View and Void — but §9's literal API surface has only `GET /platform/invoices` and `PATCH /platform/invoices/:id/void`, no route for either. Neither exists anywhere in `apps/api`: `InvoiceService`/`InvoiceRepository` gained only `void()` this volume (`apps/api/src/modules/billing/services/invoice.service.ts`), and `InvoiceStatus.DRAFT` (the natural starting point for a hand-authored re-issued Invoice) remains exactly what it was before this volume — forward-compatibility scaffolding, produced by no code path anywhere.

**Why accepted for now:** Resolved 2026-08-08, Architecture Review, matching the established §9-is-the-authoritative-shipped-surface convention already used for Volume-2's own Payment "Mark Verified"/"Attach Evidence" (folded into recording rather than built as separate actions) and, before that, Billing Volume-4's Trial Report/Forecast folding and TD-009's "no Plan-mutation endpoint" observation. Regenerate and Reissue are also the two invoice operations with the least precedent to build from — Void reused `InvoiceStatus.VOID` (already scaffolded, ADR-BILL-004) and a straightforward `ISSUED -> VOID` flip, whereas Regenerate/Reissue would need new design decisions this document doesn't specify: does Regenerate create a new Invoice number and void the old one, or mutate the existing document in place (breaking the "Invoice numbers are permanent" implicit assumption every other Invoice code path relies on)? Does Reissue re-send the same Invoice unchanged (a notification concern — no Notification module exists yet) or imply a content change? Building either without those answered would mean guessing at business rules, exactly what the doubt policy exists to prevent.

**Closing this out looks like:** a small, focused addition to `InvoiceService` (likely `regenerate(invoiceId, actorId)` and `reissue(invoiceId, actorId)`, each with a dedicated `PATCH /platform/invoices/:id/regenerate`/`reissue` route, `MANAGE_PAYMENTS`-gated like Void) once the actual semantics are confirmed — most likely alongside whatever Notification module eventually exists, since "Reissue" almost certainly implies re-notifying the tenant, a capability this codebase doesn't have yet for Billing at all (Invoice generation today is silent — no email/in-app notice fires on `INVOICE_GENERATED`).

**Trigger to revisit:** a real operator need surfaced through Support Tickets (a `BILLING` category ticket citing a wrong/duplicate/needs-resending Invoice is exactly the scenario Regenerate/Reissue would resolve) — or the Notification module landing, whichever comes first.

---

## TD-023 — Write-Capable Support Access & Tenant Impersonation

**Raised:** 2026-08-10 (Phase-8 Part-3, Platform Support, Break-Glass Access & Global Audit, PRD-007 Volume-3; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** PRD-007 Volume-3 shipped read-only Break-Glass Access — a Platform Administrator can view a specific tenant's Workspace/Users/Subscription/Invoices/Settings-overview under an audited, time-boxed `SupportSession`, but cannot write to any of it, and cannot obtain a token that acts as a tenant user (true Impersonation). §4.4/§8 of the source document name Impersonation (`IMPERSONATION_STARTED`/`ENDED`) as if it were in scope, but §9's literal API surface has zero write-capable routes anywhere under `/platform/support/*` — resolved during Architecture Review as a deliberate read-only-only scope for this volume (see `docs/ADR-PLAT-005-platform-support-break-glass-boundary.md`, "Read-only, not Impersonation"). Cross-tenant CRM/Billing _search_ (searching inside tenant business data, not just the registry-level search Volume-1 built) also remains unbuilt.

**Why accepted for now:** A real write-capable support surface — a Platform Administrator directly editing a tenant's Customer/Lead/Deal/Conversation/Invoice records, or a genuine identity-switch Impersonation token — is a materially higher-stakes capability than anything Volume-3 shipped, structurally comparable to how Volume-1 originally deferred all of Break-Glass Access rather than build it without a dedicated security review (TD-021, now closed). BR-004 ("Platform users never become tenant users") is a hard guarantee today, enforced structurally by two fully separate identity/auth/guard systems (ADR-PLAT-002); real Impersonation would be the first feature to intentionally cross that boundary, and doing so without an approved design for consent/notification, session-scoping, and audit granularity would mean guessing at exactly the kind of business/legal rule the doubt policy exists to prevent.

**Closing this out looks like:** a dedicated future volume that defines, at minimum: (1) **legal/compliance sign-off** on what cross-tenant write access and/or Impersonation requires under the platform's own terms of service and applicable data-protection obligations — this is explicitly not an engineering-only decision; (2) a **customer-notification mechanism** — per §6's "completely isolated" framing carried over from Volume-1, a tenant likely needs to be made aware (in-app, email, or both) when a Platform Administrator's session included writes to their data, not just that a read-only Support Session occurred silently, which today's Global Audit Center makes visible only to platform staff, never to the tenant itself; (3) the actual write surface design — does a Support Session get elevated write scope, or does Impersonation mint a genuinely tenant-shaped, separately-audited token; and (4) cross-tenant CRM/Billing search, which could plausibly ship independently of write access or Impersonation, as a narrower, read-only-consistent extension of this volume's existing read surface.

**Trigger to revisit:** a real, specific support-escalation need that read-only Break-Glass Access cannot address (e.g., a support case that requires correcting bad tenant data on the tenant's behalf, not just diagnosing it) — surfaced and explicitly approved as a new planning document, alongside the legal/compliance sign-off item (1) above, which should be sought independently of any particular engineering trigger.

---

## TD-024 — Governance Policy Runtime Enforcement (Identity JWT lifetime, Settings retention defaults, Platform Maintenance defaults)

**Raised:** 2026-08-10 (Phase-8 Part-4, Platform Analytics, Governance & Compliance, PRD-007 Volume-4; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** PRD-007 Volume-4 shipped a real, versioned, audited Governance Policy subsystem (`GovernancePolicy`, `docs/ADR-PLAT-007-platform-governance-strategy.md`) covering `SESSION_TIMEOUT`, `PASSWORD_POLICY`, `PLATFORM_LOGIN_POLICY`, `PLATFORM_MAINTENANCE_DEFAULTS`, `PLATFORM_LIMITS`, and `DEFAULT_RETENTION` — a Super Admin can set any of these values today, with a required reason and full version history. None of them are actually read by anything: Identity's JWT access/refresh TTLs (tenant and Platform) remain fixed at their `JWT_ACCESS_TTL`/`PLATFORM_JWT_ACCESS_TTL`-style environment variables (`apps/api/src/config/configuration.ts`), Settings' `RetentionPolicy` schema keeps its own hardcoded `default: 365` (`apps/api/src/modules/settings/schemas/retention-policy.schema.ts`), and Platform's own `PlatformMaintenanceState` toggle is unaffected by `PLATFORM_MAINTENANCE_DEFAULTS`. A `SESSION_TIMEOUT` policy set to any value has zero effect on any token issued anywhere in this codebase.

**Why accepted for now:** Resolved 2026-08-10, Architecture Review, matching the explicit instruction: "They are not wired into live Identity JWT lifetime, Settings retention defaults or other frozen module behaviour in this volume. Future runtime enforcement requires its own dedicated architecture review." Wiring six different config values into three different frozen modules' live behavior (Identity's JWT signing, Settings' `RetentionPolicy`, Platform's own `PlatformMaintenanceState`) within one volume would have meant invoking the frozen-module-governance checklist multiple times without a dedicated review for any single one of them — the same reasoning that kept Volume-3's Break-Glass Duration out of the policy set entirely, applied here to "store the value" vs. "make the value do something."

**Closing this out looks like:** per config family, its own scoped extension: (1) Identity's `TokenService`/`PlatformTokenService` sign-time logic reads `SESSION_TIMEOUT` from `GovernancePolicyRepository` (falling back to the existing env var if unset), most likely requiring the token TTL to become a per-sign-call parameter rather than a `JwtModule.register()`-time constant; (2) Settings' `RetentionPolicyRepository.getOrCreate()` seeds new workspaces' defaults from `DEFAULT_RETENTION` instead of the schema's own hardcoded default; (3) `PlatformMaintenanceService.setEnabled()` falls back to `PLATFORM_MAINTENANCE_DEFAULTS`' reason text when none is supplied in the request. Each of these touches a frozen module and needs its own sign-off under the frozen-module-governance checklist — not a single combined change.

**Trigger to revisit:** a real operator need for one of these values to actually change platform behavior at runtime (e.g., an incident requiring an immediate, code-deploy-free session-timeout tightening) — surfaced and explicitly approved per config family, since each requires touching a different frozen module.

---

## TD-025 — No Communication dashboard/summary endpoint

**Raised:** 2026-08-11 (FRD-001 Volume-3, Workspace UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-3's Workspace Dashboard Summary Cards (§4.8) need a Communication Overview alongside Subscription/Billing/CRM, but no such endpoint exists anywhere in the Communication module. Confirmed by grepping the entire module during Architecture Review: every route is per-entity (`GET /communication/broadcasts/:id/stats`, `GET /communication/campaigns/:id/stats`, `GET /communication/whatsapp/connection`, `GET /communication/whatsapp/phone-numbers`, conversation/message lists) — nothing analogous to `crm/reports/dashboard` or `billing/reports/dashboard` that returns a workspace-wide summary in one call.

**Why accepted for now:** Resolved 2026-08-10, Architecture Review, matching the explicit instruction: "Communication Overview is intentionally omitted from this volume because no backend dashboard endpoint currently exists. A Technical Debt entry may document this future enhancement." Building a client-side aggregation from existing per-broadcast/per-campaign/connection endpoints was explicitly rejected as an alternative (likely slow — N+1-shaped fan-out across every broadcast/campaign the workspace has ever run — and architecturally messy for what should be a single dashboard card), and adding a new backend route wasn't authorized as part of this frontend volume ("No backend changes are authorized as part of this volume" — Architecture Review approval).

**Closing this out looks like:** a `GET /communication/reports/dashboard`-shaped endpoint (matching the existing `billing/reports/dashboard`/`crm/reports/dashboard` convention), returning workspace-scoped aggregate figures a Summary Card can actually use — candidates: active conversations count, messages sent this period, broadcast/campaign completion rate, WhatsApp connection health. Exact field list needs its own scoped design pass (which counters matter for a glanceable card vs. which belong on a future dedicated Communication dashboard/reports screen) rather than being guessed here.

**Trigger to revisit:** either a dedicated Communication Reports/Analytics initiative (comparable to how CRM and Billing each got their own `reports` submodule), or a future Workspace/Platform Dashboard volume that specifically wants to complete the Summary Cards row.

**Still open (2026-08-11, FRD-001 Volume-4, Communication UI):** confirmed still relevant — the Communication Dashboard built in this volume (§4.1) also has no aggregation endpoint to call, and composes its own counts from four separate `status`-filtered `?limit=1` calls instead (see `docs/ADR-FE-007-communication-ui-strategy.md`, "Dashboard composition"). No new entry filed; this is the same gap, now confirmed from two independent volumes.

---

## TD-026 — No Communication real-time infrastructure (WebSocket/SSE)

**Raised:** 2026-08-11 (FRD-001 Volume-4, Communication UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-4's Inbox and Conversation View need "live" updates for new messages, message status changes, conversation updates, and assignment changes, but no push mechanism exists anywhere in the backend. Confirmed by a repo-wide search during Architecture Review: zero matches for `WebSocketGateway`, `@nestjs/websockets`, `socket.io`, or `EventSource` anywhere in `apps/api`. Every relevant domain event (`CONVERSATION_ASSIGNED`, `MESSAGE_SENT`, `CONVERSATION_STATUS_CHANGED`, etc.) is emitted via NestJS's in-process `EventEmitter2` and consumed only by a logging listener — nothing is pushed to any client, and per `docs/ADR-COMM-003`, these events "have no persisted, queryable record — they exist only as ephemeral domain events."

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction: "Real-time behaviour is approved as polling only. TanStack Query polling replaces live push for this volume. No WebSocket, SSE or custom client-side realtime implementation shall be introduced." Building a client-side real-time simulation (long-polling tricks, a fake WebSocket shim) was explicitly rejected — it would mean inventing backend behavior that doesn't exist, contrary to `ADR-FE-001`'s "no unsupported backend behaviour is simulated in the frontend" principle, and would need to be torn out the moment a real backend mechanism ships.

**Closing this out looks like:** a NestJS `@WebSocketGateway` (or SSE endpoint) emitting the same domain events already fired via `EventEmitter2` — `CONVERSATION_ASSIGNED`, `MESSAGE_SENT` (or a `MESSAGE_STATUS_CHANGED` equivalent), `CONVERSATION_STATUS_CHANGED` — scoped per-workspace (and likely per-conversation-subscription for the Conversation View specifically), with a documented connection/auth handshake. The frontend swap is comparatively small once that exists: `inbox-list.tsx`/`conversation-view.tsx`'s `refetchInterval`-based queries become event-triggered `queryClient.invalidateQueries` calls instead.

**Trigger to revisit:** a real operator/customer complaint about staleness (agents missing new messages until the next 15-second poll), or a dedicated Communication real-time infrastructure initiative — whichever comes first.

---

## TD-027 — No Communication attachment/media support (send or inbound-display)

**Raised:** 2026-08-11 (FRD-001 Volume-4, Communication UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-4's Conversation View, Message Composer, and Templates sections all named Attachments (§4.3/§4.4/§4.10) as in-scope, but no media pipeline exists anywhere in Communication — not for sending, not for inbound display. Confirmed during Architecture Review: `SendMessageDto`/`SendTemplateMessageDto`/`ReplyConversationDto` have no media field at all; `Message.schema.ts`'s own doc comment states inbound non-text messages are "recorded with their Meta `type` and the full original payload in `rawPayload`, so no data is lost even though this slice doesn't process media — closing that gap (download/store to Cloudinary, captions, etc.) is later scope"; and `StorageService` (the existing Cloudinary signed-upload pattern, used today only by Workspace Branding) has zero usages anywhere in the Communication module.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction: "Attachments and Labels are excluded from this volume because no backend capability exists." Neither send-side media (composing and attaching a file to an outbound message) nor inbound-display media (rendering an image/document a customer sent) has anything to be built against — building either would mean a frontend feature with no functioning backend counterpart.

**Closing this out looks like:** two related but separable pieces of backend work — (1) outbound: a media field on `SendMessageDto`/message-sending flow, most likely reusing the existing `StorageService.generateUploadSignature()` Cloudinary pattern (get-signature → direct upload → confirm, same three-step flow Workspace Branding already established); (2) inbound: a webhook-time media-download pipeline that fetches the Meta media URL (which expires quickly) and persists it to durable storage, plus exposing a `mediaUrl` field on `MessageSummary` for the frontend to render. These don't have to ship together — inbound-display alone would already close much of the FRD's Conversation View gap even before outbound sending exists.

**Trigger to revisit:** a real customer-support need for image/document exchange (a very common WhatsApp Business use case — this is likely to be requested soon after this volume ships), or a dedicated Communication Attachments initiative.

---

## TD-028 — No Communication/Contact labels (zero backend support anywhere)

**Raised:** 2026-08-11 (FRD-001 Volume-4, Communication UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-4 named a full Labels section (§4.8: list/create/edit/delete, color, usage count) plus label references on Conversation View and Contacts, but Labels don't exist as a backend resource anywhere in the repository — not in Communication, not in CRM. Confirmed during Architecture Review: no `LabelSchema`, no `labels.controller.ts`, no CRM tagging model, and no `LABEL`/`TAG` entry in `PERMISSION_MATRIX` anywhere in `apps/api` or `packages/shared-types`.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction: "Attachments and Labels are excluded from this volume because no backend capability exists." This is a hard gap, not a naming mismatch — there is no underlying entity to build CRUD UI against, and no "usage count" to compute since nothing produces the underlying data.

**Closing this out looks like:** a genuinely new backend slice — a `Label` schema (name, color, workspace-scoped), CRUD routes, a many-to-many association with Conversation and/or Contact, and a `PERMISSION_MATRIX` row for who can manage labels vs. just apply them. Worth designing once, shared between Communication and CRM if both need tagging, rather than building two independent label systems later.

**Trigger to revisit:** a real, specific request to categorize/filter conversations or contacts beyond what `status`/`assignedToUserId` already provide — surfaced as its own scoped backend initiative, not bundled into an unrelated volume.

---

## TD-029 — No Contacts list/search endpoint

**Raised:** 2026-08-11 (FRD-001 Volume-4, Communication UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** No `GET /contacts`, `GET /contacts/:id`, `PATCH /contacts/:id`, or contact search route exists anywhere in the backend — `ContactRepository` exposes only internal lookup methods (`findOrCreate`, `findByIdForWorkspace`, `findByIdsForWorkspace`), never through a controller. This has two concrete consequences in FRD-001 Volume-4: (1) Contacts could not be built as a standalone module (§4.5) — resolved by presenting contact info as a read-only panel embedded in Conversation View, using only the fields `ConversationSummary` already carries (`ADR-FE-007`, "Contacts is not a standalone module"); (2) Broadcast/Campaign creation's `targetContactIds` picker (`use-known-contacts.ts`) has no real audience source to draw from, so it's limited to the distinct contacts appearing in the 100 most recently active conversations — not a full, searchable contact base.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review — no backend changes were authorized as part of this frontend volume, and both consequences were explicitly reviewed and accepted as the correct scope for what's actually buildable today rather than left implicit.

**Closing this out looks like:** a real `GET /contacts` (list, with search/filter by name or phone) and `GET /contacts/:id` route, likely alongside a proper Contacts module boundary decision (does Contact stay Communication-owned, per `ADR-COMM-002`, or does it need CRM-style enrichment — custom fields, ownership, lifecycle — at which point it starts to resemble CRM's `Customer` entity and that overlap needs its own resolution). Once it exists, `use-known-contacts.ts` becomes a real searchable picker instead of a recent-conversations approximation, and a genuine Contacts List/Profile screen becomes buildable.

**Trigger to revisit:** a real operator complaint that Broadcast/Campaign audiences can't reach contacts who haven't messaged recently, or a CRM-Communication contact-model unification initiative.

---

## TD-030 — `@wapp/shared-types` Communication enums have drifted from the real backend

**Raised:** 2026-08-11 (FRD-001 Volume-4, Communication UI; discovered during implementation, not part of the original Architecture Review checklist)
**Status:** Open

**What:** `@wapp/shared-types`'s `ConversationStatus` and `TemplateStatus` enums don't match what `apps/api`'s Communication module actually returns — `ConversationStatus.PENDING_CUSTOMER` vs. the real schema's `PENDING`; `TemplateStatus.SUBMITTED` vs. the real schema's `PAUSED`. `CampaignStatus`, `MessageStatus`, `MessageDirection`, and `AssignmentStrategy` have no `@wapp/shared-types` equivalent at all. The Communication module defines all of these locally in its own schema files rather than importing the shared package — despite `ConversationStatus`'s own doc comment in `@wapp/shared-types` tracing to "PRD-003 Part 2 §G," the same section the Communication module's real implementation covers, suggesting the shared package was scaffolded ahead of the real implementation and never reconciled once it shipped.

**Why accepted for now:** Discovered mid-implementation, 2026-08-11 — not one of the four gaps the Architecture Review approval named, so it's filed separately rather than folded into an existing entry. `apps/web`'s own Communication types (`types/conversation.ts`, `types/template.ts`, etc.) were written to mirror the real, running backend instead of the drifted shared package, and `packages/ui/src/lib/status-color.ts`'s `getStatusColor` was extended with the real string-literal values directly rather than importing the incorrect enum — both documented inline. Fixing `@wapp/shared-types` itself was judged out of this frontend volume's authority: it's a shared package other code may already reference, and changing an enum's members needs its own review, not a silent fix bundled into an unrelated UI volume.

**Closing this out looks like:** correcting `ConversationStatus.PENDING_CUSTOMER` → `PENDING` and `TemplateStatus.SUBMITTED` → `PAUSED` in `@wapp/shared-types`, adding `CampaignStatus`/`MessageStatus`/`MessageDirection`/`AssignmentStrategy`, and then migrating `apps/api`'s Communication module to import from the shared package instead of maintaining local duplicates — plus updating `apps/web`'s types and `packages/ui`'s `getStatusColor` to consume the corrected shared enums instead of local mirrors/raw strings. A search across the codebase for any other consumer of the current (wrong) `ConversationStatus`/`TemplateStatus` values should happen before the enum members are renamed, in case something already depends on the incorrect names.

**Trigger to revisit:** the next module that needs a canonical, shared Communication status type (a future Platform-level Communication view, or a reporting module cutting across Communication data) — that's the point duplicating a third local copy stops being tenable.

---

## TD-031 — `lastCustomerMessageAt` not exposed on `ConversationSummary` (blocks proactive compliance-window UX)

**Raised:** 2026-08-11 (FRD-001 Volume-4, Communication UI; discovered during implementation, not part of the original Architecture Review checklist)
**Status:** Open

**What:** The Meta 24-hour customer-service window (free-text replies blocked outside it, template messages exempt) is enforced server-side via `Conversation.lastCustomerMessageAt` — a field that exists on the Mongoose schema but is never serialized into `ConversationSummary` (confirmed against both `communication.mapper.ts` and `communication.types.ts`). The backend's own compliance documentation (`docs/COMM-COMPLIANCE-ENGINE.md`) explicitly names proactively warning an agent before they attempt an out-of-window free-text send as "a frontend concern once a frontend exists" — but building that proactive check requires exactly the field that isn't exposed.

**Why accepted for now:** Discovered mid-implementation, 2026-08-11 — not one of the four gaps the Architecture Review approval named. `message-composer.tsx` handles the window reactively instead: a failed free-text send that returns a 403 surfaces a warning with a one-click switch to the Template picker, matching the backend's documented _intent_ for the outcome, just triggered after the attempt rather than before it (see `docs/ADR-FE-008-communication-inbox-strategy.md`, "Message Composer: the 24-hour compliance window is handled reactively"). No client-side approximation of `lastCustomerMessageAt` (e.g., guessing from `lastMessageAt` plus message direction) was attempted — `lastMessageAt` includes outbound messages too, so it can't substitute for the real field without risking a wrong answer in either direction.

**Closing this out looks like:** exposing `lastCustomerMessageAt` (or a computed `withinCustomerServiceWindow: boolean` / `customerServiceWindowExpiresAt: string | null`, arguably a cleaner contract than a raw timestamp for the frontend to reason about) on `ConversationSummary`. Once available, the Composer can proactively disable the free-text mode and default to the Template tab before the agent even starts typing, rather than after a failed send — a small change since the reactive UX plumbing already exists.

**Trigger to revisit:** the next real Composer complaint about the reactive flow being confusing (typing a message, then discovering it can't be sent), or when `docs/COMM-COMPLIANCE-ENGINE.md`'s own named "Proactive UX" follow-up gets picked up.

---

## TD-032 — No Customer Report endpoint

**Raised:** 2026-08-11 (FRD-001 Volume-5, CRM UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-5's Reports screen (§4.10) named a "Customer Report" alongside Lead/Deal/Activity Report, but `apps/api`'s CRM Reports controller exposes only `GET /crm/reports/{dashboard,leads,deals,activities,forecast}` — confirmed by reading `reports.controller.ts` directly during Architecture Review, not just the ADR summaries. No customer-segmentation, lifecycle, or acquisition-source aggregate route exists anywhere in the module.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction that Reports is scoped to Lead/Deal/Activity only this volume. `reports-view.tsx` renders exactly three report sections; no client-side aggregation over `customerService.list()` was attempted as a substitute — that would mean paginating the entire Customer collection into memory to compute figures a real backend aggregate should own, and would silently imply a "Customer Report" the backend was never asked to produce.

**Closing this out looks like:** a `GET /crm/reports/customers` route (matching the existing `leads`/`deals`/`activities` convention) returning workspace-scoped aggregates — candidates: status distribution (Active/Blocked/Archived), source distribution, average customer age, customers-with-no-open-deal count. Exact field list needs its own scoped design pass.

**Trigger to revisit:** a future CRM Reports expansion volume, or a real request for customer-segmentation insight that the current three reports can't answer.

---

## TD-033 — No Sales Report endpoint

**Raised:** 2026-08-11 (FRD-001 Volume-5, CRM UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-5's Reports screen (§4.10) also named a "Sales Report," distinct from the Deal Report already exposed — presumably a rep/team-level sales-performance rollup rather than deal-stage aggregates. No such route exists; the closest backend capability is `GET /crm/reports/team-performance` (`TeamPerformanceReport`, mirrored in `types/crm.ts` but never surfaced by any screen this volume, per its own doc comment: "not one of the FRD's named report screens, but exposed by the backend").

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the same "Lead/Deal/Activity Report only" scope decision as TD-032. `TeamPerformanceReport` was deliberately left unused rather than repurposed as a stand-in "Sales Report" — its shape (per-user deals won/leads qualified/tasks completed) doesn't match what a "Sales Report" would typically mean (revenue trends, quota attainment, win-rate over time), and guessing at that mapping risked shipping a mislabeled screen.

**Closing this out looks like:** either a dedicated `GET /crm/reports/sales` endpoint once the exact intended shape is specified, or — if `TeamPerformanceReport` turns out to be what "Sales Report" meant all along — a scoped follow-up to build a screen against the endpoint that already exists, confirmed against the Architect's original intent rather than assumed.

**Trigger to revisit:** the next CRM Reports expansion volume, when the Architect can clarify whether "Sales Report" and the existing `team-performance` endpoint are the same thing.

---

## TD-034 — No Calendar support for Meetings

**Raised:** 2026-08-11 (FRD-001 Volume-5, CRM UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-5's Calendar (§4.9) is scoped to Tasks and Follow-ups only (Architecture Review approval), but `ActivityType.MEETING` is a real, full activity type with its own timeline presence (`ActivityCard`'s `TYPE_ICON` already renders it) — it simply never appears on `calendar-view.tsx`'s grid, which only queries `ActivityType.TASK`/`ActivityType.FOLLOW_UP`.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction that Calendar covers Tasks and Follow-ups only this volume. Meetings have no dedicated date-range-filterable field exposed by `activityService.list()` beyond the generic `dueFrom`/`dueTo` (which only ever filters Task's `dueDate` server-side, per `activity.service.ts`'s own doc comment) — a Meeting's relevant date isn't currently modeled distinctly enough from a generic Activity's `createdAt` to place it reliably on a calendar grid without guessing.

**Closing this out looks like:** either a dedicated `meetingDate`-equivalent field on Meeting-type Activities plus server-side range filtering for it (mirroring how Task's `dueDate` and Follow-up's `followUpDate` already work), or an explicit product decision that Meetings belong on the Calendar via a different field entirely. Once resolved, `calendar-view.tsx`'s `CalendarChip`/`itemsForDay` composition already generalizes to a third activity type with minimal change.

**Trigger to revisit:** a real scheduling need for Meetings specifically (as opposed to Tasks/Follow-ups), or a future Calendar-expansion volume.

---

## TD-035 — No Calendar support for Calls

**Raised:** 2026-08-11 (FRD-001 Volume-5, CRM UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** Same gap as TD-034, for `ActivityType.CALL`. Calls have no calendar-relevant date field distinct from `createdAt`, and were excluded from Calendar's scope by the same Architecture Review decision.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review — Calendar is Tasks and Follow-ups only this volume; Calls remain visible in the standalone Activities list (`activity-list.tsx`) and each Customer/Deal's `ActivityFeed`, just not on the Calendar grid.

**Closing this out looks like:** the same shape of fix as TD-034 — a scheduled-call-date field with server-side range filtering, once product defines whether Calls need to be calendar-schedulable (as opposed to logged after the fact, which is how the current data model reads).

**Trigger to revisit:** a real need to schedule (not just log) Calls, or a future Calendar-expansion volume — likely bundled with TD-034 and TD-036 as one combined Calendar-scope-expansion initiative given the identical shape of the gap.

---

## TD-036 — No Calendar support for Emails

**Raised:** 2026-08-11 (FRD-001 Volume-5, CRM UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** Same gap as TD-034/TD-035, for `ActivityType.EMAIL`. No calendar-relevant date field, excluded from Calendar's scope by the same Architecture Review decision.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review — Calendar is Tasks and Follow-ups only this volume; Emails remain visible in the standalone Activities list and `ActivityFeed`, just not on the Calendar grid.

**Closing this out looks like:** the same shape of fix as TD-034/TD-035 — a scheduled-send-date field with server-side range filtering, if Email activities are ever meant to represent a scheduled send rather than a logged record of one already sent.

**Trigger to revisit:** the same combined Calendar-scope-expansion initiative named in TD-034/TD-035.

---

## TD-037 — No Customer → Lead reverse lookup

**Raised:** 2026-08-11 (FRD-001 Volume-5, CRM UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** A Customer is created exclusively as a side effect of `POST /crm/leads/:id/convert` (ADR-CRM-010), and `LeadSummary.customerId` records the forward link once conversion happens — but there is no reverse route or field (`GET /crm/customers/:id/lead` or a `sourceLeadId` on `CustomerSummary`) letting a viewer navigate from a Customer back to the Lead it originated from. Confirmed against `crm.types.ts` and `customer.controller.ts` directly: `CustomerSummary` has no lead-reference field at all.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review — named as an accepted gap rather than something to route around. `customer-detail.tsx` has no "View originating Lead" link; the only cross-reference this volume ships is the forward direction, `lead-detail.tsx`'s "View Customer" link once a Lead is converted (`convertedAt` set). Adding a client-side search (scanning Leads for `customerId === this customer's id`) was rejected as a substitute — Leads have no `customerId`-filter query parameter either (`lead.service.ts`'s `list()` params confirmed), so it would require fetching the entire Lead collection to find one record.

**Closing this out looks like:** exposing the reverse link somewhere — either a `sourceLeadId` field added to `CustomerSummary` (cheapest, since the relationship already exists in the data the convert transaction wrote), or a dedicated `customerId` filter on `GET /crm/leads`. Either unblocks a simple "View originating Lead" link on `customer-detail.tsx`.

**Trigger to revisit:** a real support/sales workflow need to trace a Customer back to its originating Lead (common in attribution/source-effectiveness analysis), or a future CRM cross-linking initiative.

---

## TD-038 — No Invoice PDF/download endpoint

**Raised:** 2026-08-11 (FRD-001 Volume-6, Billing UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-6's Invoices screen (§4.4) named "View, Download" as the supported actions, but no PDF or binary download route exists anywhere in the backend — confirmed by grepping the entire `billing` and `platform` modules for `pdf`/`download` during Architecture Review. `InvoiceController` (`billing/invoices`) has exactly two routes, `GET` (list) and `GET :id` (detail), both read-only JSON — no third route of any kind.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction that Invoice Download is excluded from this volume because no backend endpoint exists. `invoice-detail.tsx` renders the same fields the `GET :id` response already provides (no separate document to fetch); no attempt was made to repurpose `GET /billing/reports/export` (CSV/Excel, shaped for multi-row report data across many Invoices) into a single-invoice PDF substitute — the two are architecturally unrelated: one produces a tabular report, the other would need to render one formatted document.

**Closing this out looks like:** a `GET /billing/invoices/:id/pdf` (or `/download`) route generating and streaming a formatted PDF for one Invoice — most likely reusing whatever templating/PDF-generation library the eventual choice settles on (none exists in the backend today; `exceljs`, used for Excel report exports, doesn't produce PDFs). Once it exists, `invoice-detail.tsx` gains a "Download" button following the same authenticated-blob pattern `crmService.exportReport()`/`billingService.exportReport()` already established.

**Trigger to revisit:** a real customer/accounting need for a shareable, printable Invoice document (a very common expectation for any paid SaaS product), or a dedicated Billing Documents initiative.

---

## TD-039 — No tenant-scoped Billing History endpoint

**Raised:** 2026-08-11 (FRD-001 Volume-6, Billing UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-6's Billing History Timeline (§4.6) wants a read-only feed of subscription/plan/trial/invoice/payment events, and the data genuinely exists — `BillingHistoryListener` writes 17 distinct event types into a durable `billing_history_entries` Mongo collection via `BillingHistoryRepository`, unlike Communication/CRM's purely ephemeral `EventEmitter2`-only domain events. But the only route exposing it, `GET /platform/billing/history?workspaceId=&limit=`, is Platform-operator-scoped (`PlatformPermission.VIEW_PLATFORM_BILLING`, a separate `PlatformAuthGuard`/`PlatformPermissionsGuard` system, built for Customer Support tooling per PRD-007 Volume-2 §4.5) — structurally unreachable from a tenant/Workspace session. No tenant-facing controller ever injects `BillingHistoryService`.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction that Billing History Timeline is excluded from this volume: "The write-side exists, but no tenant-scoped read endpoint currently exists. No client-side approximation shall be introduced." Composing a partial timeline from the Subscription/Invoice/Payment list endpoints was explicitly rejected — it would misrepresent event coverage (missing trial-started, grace-period-entered, and other events with no corresponding list-endpoint row) and would mean simulating a "history" feature the backend doesn't actually provide in that shape, contrary to `ADR-FE-001`'s "no unsupported backend behaviour is simulated in the frontend" principle.

**Closing this out looks like:** a small, workspace-scoped tenant-facing route — e.g. `GET /billing/history` on the existing `BillingReportsController` or a new dedicated controller, gated by the ordinary `BILLING_ACCESS` permission (not the Platform system) — reading from the same `BillingHistoryRepository.findByWorkspace()` the Platform route already uses. This should be cheap: the write side, the repository, and the exact response shape (`BillingHistoryEntrySummary`) all already exist; only a new controller route and permission check are needed.

**Trigger to revisit:** a real tenant Owner/Administrator request for billing-event history visibility, or the next Billing volume that wants to complete §4.6.

---

## TD-040 — Billing Forecast has no multi-period or trial-conversion projection

**Raised:** 2026-08-11 (FRD-001 Volume-6, Billing UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-6's Forecast screen (§4.8) named three distinct capabilities — Revenue Forecast, Renewal Forecast, Trial Conversion — but `apps/api`'s only forecast-shaped data is `RevenueReport.forecast: {nextRenewalDate, expectedAmount}`, a single next-renewal figure folded into the Revenue Report (`ADR-BILL-010`; confirmed zero matches for "forecast" anywhere else in the `billing` module). There is nothing resembling CRM's `ForecastReport` (`monthlyForecast`/`quarterlyForecast`/`yearlyForecast` buckets, FRD-001 Volume-5) — no multi-period revenue projection, no renewal-likelihood modeling across multiple future renewals, and no trial-conversion-probability field anywhere in `billing.types.ts`.

**Why accepted for now:** Resolved 2026-08-11, Architecture Review, matching the explicit instruction: "Forecast is intentionally minimal... Renewal Forecast and Trial Conversion Forecast are excluded because no backend support exists." `forecast-view.tsx` renders only the two fields the backend actually returns (`nextRenewalDate`, `expectedAmount`, the latter null until GTM pricing is approved — TD-009) — no client-side extrapolation (e.g., projecting `expectedAmount` forward across future renewal cycles, or estimating trial-conversion likelihood from `SubscriptionStatus` history) was attempted, since either would mean inventing a commercial/statistical model the backend never specified.

**Closing this out looks like:** dedicated backend work to define and compute the two missing forecast types — a periodized revenue-forecast endpoint (mirroring CRM's bucket-based `ForecastReport` shape) and a trial-conversion-probability computation (likely requiring historical trial-outcome data this Phase doesn't yet track in an aggregatable way). Both are commercial/data-modeling decisions, not something to guess at in a frontend volume.

**Trigger to revisit:** a real business need for forward-looking revenue planning (once GTM pricing is approved and Plan prices are non-null, this becomes far more useful), or a dedicated Billing Analytics/Forecasting initiative.

---

## TD-041 — Administrator's `VIEW_ONLY` Billing permission not enforced server-side for Subscription mutations

**Raised:** 2026-08-11 (FRD-001 Volume-6, Billing UI; discovered during implementation, not part of the original Architecture Review checklist)
**Status:** Open

**What:** `PermissionsGuard.canActivate` (`permissions.guard.ts`) only checks `level !== NONE` — it does not distinguish `VIEW_ONLY` from `FULL` at the framework level. `Administrator` holds `BILLING_ACCESS` at `VIEW_ONLY` per `permission-matrix.ts`, but because the guard's check is binary, `Administrator` is not actually blocked server-side today from calling `POST /billing/subscription/{upgrade,downgrade,cancel}` — only `PaymentController`'s separate, explicit `ensureOwner()` check narrows Payment/Refund recording specifically; no equivalent check exists for Subscription mutations.

**Why accepted for now:** Discovered mid-implementation, 2026-08-11 — not one of the gaps the Architecture Review's own approval named going in, but flagged proactively and folded into the Architect's final Tech Debt list. `apps/web`'s `subscription-view.tsx` already gates Upgrade/Downgrade/Cancel on `useHasFullPermission(BILLING_ACCESS)` (`=== FULL`), which correctly evaluates `false` for Administrator — so no frontend change was needed to stay correct, and no UI exposes these actions to a VIEW_ONLY-level user. But this is convenience rendering only (`ADR-FE-001`, BR-004) — the backend's own `@RequirePermission` guard is supposed to be the authoritative enforcement layer, and today it isn't, for this specific case.

**Closing this out looks like:** either extending `PermissionsGuard` to support a `@RequireFullPermission` variant (checking `=== FULL`, distinct from the existing `!== NONE` check) for routes that need it, or adding an explicit in-controller check to `SubscriptionController` mirroring `PaymentController`'s `ensureOwner()` pattern (though Subscription mutations are intended for `FULL`-level users generally, not Owner-only specifically, so the two controllers' fixes likely shouldn't be identical). A repo-wide audit for other routes with the same VIEW_ONLY-vs-FULL gap would be worth doing at the same time, since this pattern could recur anywhere a permission has more than two levels.

**Trigger to revisit:** a security review or penetration test that would otherwise catch this, or the next volume that introduces another multi-level (`VIEW_ONLY`/`FULL`) permission with write routes, making a systemic fix worth doing once rather than per-controller.

---

## TD-042 — No Webhook delivery-history endpoint

**Raised:** 2026-08-12 (FRD-001 Volume-7, Settings UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-7's Webhooks screen (§4.9) named "Recent Deliveries" as a display element, but no route exposes the real, persisted delivery-log data. `webhook-delivery-log.schema.ts`'s `webhook_delivery_logs` collection (one row per attempt: `webhookId, workspaceId, event, success, statusCode, error, createdAt`) and `WebhookDeliveryLogRepository.findRecentByWebhook(webhookId, limit)` both exist and work — confirmed by reading them directly — but `findRecentByWebhook` is grep-confirmed called nowhere except its own file. No `WebhooksController` route (or any other controller) ever exposes it.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review, matching the explicit instruction that Recent Delivery History is excluded. `webhooks-view.tsx`/`WebhookCard` surface only `WebhookSummary`'s existing `lastDeliveryAt`/`lastError` fields (the most-recent-attempt signal, which is real and already returned) — no client-side approximation of a delivery history was attempted, since there's no data to approximate it from beyond that one summary field.

**Closing this out looks like:** a small, focused addition — `GET settings/webhooks/:id/deliveries` (paginated), `EDIT_WORKSPACE`-gated like every other Webhooks route, reading from the repository method that already exists. This should be cheap: the write side, the repository, and the natural response shape all already exist; only a new controller route is needed.

**Trigger to revisit:** a real need to debug a failing webhook integration (the single most likely reason anyone would ask for this), or a future Webhooks/Integrations expansion volume.

---

## TD-043 — Audit Logs have no free-text search

**Raised:** 2026-08-12 (FRD-001 Volume-7, Settings UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-7's Audit Logs screen (§4.10) named "Search" alongside "Filters," but `AuditLogQueryDto` (`audit-log-query.dto.ts`) only accepts `category`, `page`, and `limit` — no free-text query parameter exists anywhere in `AuditController`/`AuditLogService`.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review, matching the explicit instruction that Audit Logs shall expose Category Filter and Pagination only, with free-text search excluded because no backend capability exists. `audit-log-view.tsx` renders a category `<Select>` and Previous/Next pagination controls only — no search input was built against a parameter that doesn't exist.

**Closing this out looks like:** either a MongoDB text index over `AuditLogEntry`'s `module`/`entity`/`action` fields plus a `search` query param on `AuditLogQueryDto`, or (if actor/IP searching is also wanted) a more general filter set. Given the security-sensitive nature of this data (`EDIT_WORKSPACE`-gated specifically because of the actor/IP/device fields it exposes, per `AuditController`'s own doc-comment), any search capability added here should get its own scoped review rather than being bundled into an unrelated feature.

**Trigger to revisit:** a real investigative need (tracing a specific action across a large log) that pagination alone can't reasonably serve, or a future Audit/Compliance-focused volume.

---

## TD-044 — No Data Export job-list endpoint (single most-recent job only)

**Raised:** 2026-08-12 (FRD-001 Volume-7, Settings UI; discovered during implementation, not part of the original Architecture Review checklist)
**Status:** Open

**What:** FRD-001 Volume-7's Data Export screen (§4.11) named "Export Jobs" (plural) as a display element, implying a history list — but `DataManagementController` has exactly two routes, `POST settings/export` (create) and `GET settings/export/:id` (status by id), with no `GET settings/export` list route anywhere. Confirmed by reading the controller directly.

**Why accepted for now:** Discovered mid-implementation, 2026-08-12 — not one of the gaps the Architecture Review's own approval enumerated by name (it approved "Job List, Status, Progress, Result Link" without the underlying single-job constraint being visible yet), but it's a direct, load-bearing consequence of the already-approved "no download proxy endpoint" finding, so it's filed alongside it rather than silently worked around. `export-view.tsx` tracks only the single most-recently-created job (its id cached in `localStorage`, polled via `refetchInterval` while pending) — which is a reasonable adaptation, not a workaround, since the backend itself enforces at most one active job per workspace at any time (`DataExportService` rejects a second `POST` while one is `PENDING`/`PROCESSING`). There is currently no way to look back at a _completed_ job from a prior session once its id is no longer in `localStorage`.

**Closing this out looks like:** a `GET settings/export` list route (paginated, `EDIT_WORKSPACE`-gated like the rest of Data Management) returning past `ExportJobSummary` rows for the workspace, so a real history table becomes buildable and the frontend no longer depends on `localStorage` to remember what was last requested.

**Trigger to revisit:** a real need to re-download or audit a previously-completed export after the requesting browser's `localStorage` has been cleared, or a future Data Management expansion volume.

---

## TD-045 — WhatsApp "Connect" (Meta Embedded Signup) not built

**Raised:** 2026-08-12 (FRD-001 Volume-7, Settings UI; formally tracked as a Governance Recommendation per Architecture Review)
**Status:** Open

**What:** FRD-001 Volume-7's Integrations screen (§4.7) named "Connect" alongside Disconnect/Test Connection/Refresh Metadata, but connecting a new WhatsApp Business Account requires a genuine Meta Embedded Signup flow — `POST communication/whatsapp/connect` (`ConnectWhatsAppDto`) needs a `code`/`wabaId`/`phoneNumberId` triple only obtainable via Facebook's JS SDK, an OAuth-style popup, and a `postMessage` handshake during that same browser session (the documented Embedded Signup pattern, per the DTO's own doc-comment). No Meta App ID, SDK script, or any related configuration exists anywhere in `apps/web` today — confirmed by a repo-wide search.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review, matching the explicit instruction to show connection status only, with no Connect action this volume. Building the full Embedded Signup integration — loading a third-party SDK, handling a cross-window OAuth handshake, and requiring real Meta App credentials just to test — was judged a substantial standalone effort, not a natural fit for a "thin presentation layer" Settings volume alongside seven other new screens. `integrations-view.tsx`'s WhatsApp card renders `connected`/`status`/`businessName` read-only and offers Disconnect/Test Connection/Refresh Metadata only when already connected.

**Closing this out looks like:** a dedicated frontend effort scoped around the Meta Embedded Signup flow specifically — obtaining and configuring a Meta App ID, loading the Facebook JS SDK, implementing the popup + `postMessage` listener, and wiring the resulting `code`/`wabaId`/`phoneNumberId` into the existing (and already-working) `POST communication/whatsapp/connect` route. The backend side of this needs no further work — it's purely a frontend integration effort once Meta app credentials are provisioned.

**Trigger to revisit:** a real customer onboarding need (a new workspace with no WhatsApp connection yet has no self-service path to connect one today), or a dedicated WhatsApp Onboarding initiative.

---

## TD-046 — Global Announcements have no lifecycle (status/scheduling/publish/archive)

**Raised:** 2026-08-12 (FRD-001 Volume-8, Platform Administration UI)
**Status:** Open

**What:** `PlatformAnnouncementController` exposes only `POST /platform/announcements` and `GET /platform/announcements` — no status field (Active/Scheduled/Expired), no scheduled-publish date, and no Archive route exist anywhere on `PlatformAnnouncementSummary` or its service. The domain event an announcement create fires also has zero consumers today — nothing is ever actually delivered to or surfaced for a tenant.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: "minimal Create + List only, no fabricated Active/Scheduled/Expired states." `announcements-view.tsx` and the new `AnnouncementCard` primitive expose Create and List exclusively; no status badge or scheduling UI was built, since inventing client-side lifecycle state with no backend counterpart would misrepresent what the feature actually does.

**Closing this out looks like:** backend work first — a status field and state machine on `PlatformAnnouncementSummary`, a scheduled-publish mechanism, an Archive route, and a real consumer for the announcement-created domain event (e.g. a tenant-facing banner or notification) — followed by the corresponding frontend lifecycle UI.

**Trigger to revisit:** a real product need for scheduled or time-limited platform-wide messaging, or a tenant-facing consumer being built for the existing (currently unconsumed) domain event.

---

## TD-047 — Platform Analytics has no User Growth, Subscription Trends, or Activity Trends

**Raised:** 2026-08-12 (FRD-001 Volume-8, Platform Administration UI)
**Status:** Open

**What:** FRD-001 Volume-8's planning document named 6 Analytics categories; `GET /platform/analytics` and `GET /platform/kpis` together only cover Platform KPIs, Revenue, and Workspace Growth. "User Growth," "Subscription Trends," and "Activity Trends" have no backend endpoint, service method, or DTO anywhere in `apps/api`'s platform module — confirmed by a direct read of every platform analytics service file.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: represent only the 3 real categories, no fabricated data. `analytics-view.tsx` renders Platform KPIs/Revenue/Workspace Growth via `SummaryCard` tiles and `RevenueChart` categorical comparisons only; the other 3 named categories are simply absent from the screen rather than shown empty or mocked.

**Closing this out looks like:** backend work to add the missing aggregation queries (user signup/growth over time, subscription tier transition trends, platform/tenant activity trends) and expose them via new or extended `GET /platform/analytics`-family routes, followed by extending `analytics-view.tsx` with the corresponding chart sections.

**Trigger to revisit:** a Product/Architect decision that these 3 categories are needed for platform operations reporting, prioritized against other backend work.

---

## TD-048 — Break-Glass has no Reject route for a `REQUESTED` session

**Raised:** 2026-08-12 (FRD-001 Volume-8, Platform Administration UI)
**Status:** Open

**What:** `break-glass.service.ts`'s available routes are `requestAccess`/`approveAccess`/`startSession`/`endSession`/`listSessions`/`getWorkspaceOverview` — there is no `PATCH .../reject` or equivalent on `PlatformBreakGlassController`. A `REQUESTED` session can only ever transition to `APPROVED`; there is no way for a Super-Admin to formally deny a request (it can only be left pending indefinitely or expire).

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: "Break-Glass Approve-only action per the approved resolution" — no Reject UI was built since no backend route exists to call. `break-glass-view.tsx` offers Approve on `REQUESTED` sessions and nothing else.

**Closing this out looks like:** a `PATCH /platform/support/access/:id/reject` (or similar) route and a `REJECTED` (or reuse of an existing terminal) `SupportSessionStatus` value on the backend, followed by adding a Reject action alongside Approve in `break-glass-view.tsx`.

**Trigger to revisit:** an operational need to explicitly deny and record a rejected Break-Glass request, rather than leaving it to expire silently.

---

## TD-049 — No Reset Password route for Platform Users

**Raised:** 2026-08-12 (FRD-001 Volume-8, Platform Administration UI)
**Status:** Open

**What:** `platform-users.service.ts`'s available routes are `list`/`create`/`setActive`/`updateRole` — there is no reset-password route on `PlatformUsersController`. A Super-Admin has no self-service way to reset another Platform User's password from the console; the only account-recovery path today is whatever the Platform User's own forgot-password flow (if any) provides.

**Why accepted for now:** No Reset Password UI was built anywhere in `platform-users-view.tsx` since no backend route exists to call — building a form against a nonexistent endpoint was ruled out during implementation.

**Closing this out looks like:** a `POST /platform/users/:id/reset-password` (or equivalent, e.g. issuing a reset token/temporary password) route on the backend, followed by adding the corresponding action to `platform-users-view.tsx`, gated the same as every other write action (`useHasFullPlatformPermission(MANAGE_PLATFORM_USERS)`).

**Trigger to revisit:** an operational need — a locked-out Platform User with no working self-service recovery path.

---

## TD-050 — Feature Flags have no per-workspace override

**Raised:** 2026-08-12 (FRD-001 Volume-8, Platform Administration UI)
**Status:** Open

**What:** `PlatformFeatureFlagsService` supports exactly one global override tier per `FeatureFlagKey` (`enabled: boolean | null`, where `null` means "inherit the workspace-level default"). There is no per-workspace override mechanism anywhere on the backend — a Super-Admin can only flip a flag platform-wide, never for a single tenant.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: "single global override per flag, not per-workspace — Workspace Overrides has no backend support anywhere." `feature-flags-view.tsx` and the new `FeatureFlagCard` primitive expose only the single global Enable/Disable action per flag; no per-workspace UI was built.

**Closing this out looks like:** backend work to add a per-workspace override layer (e.g. a `workspaceId`-scoped feature-flag collection consulted before falling back to the platform-wide value), followed by a per-workspace override UI — likely surfaced from the Workspace Registry's workspace-detail view rather than this screen.

**Trigger to revisit:** a real need to enable/disable a feature for a single tenant (e.g. a beta customer) without affecting the rest of the platform.

---

## TD-051 — Dark-mode Badge contrast falls narrowly short of WCAG AA for `danger`/`info` variants

**Raised:** 2026-08-12 (FRD-001 Volume-9, Performance/Accessibility/PWA)
**Status:** Open

**What:** A computed WCAG relative-luminance audit of every design-token pairing found `Badge`'s dark-mode `danger`/`info` variants (`text-danger-500`/`text-info-500` on a `bg-danger-500/10`/`bg-info-500/10` tint over a typical `neutral-900` background) measure 4.31:1 and 4.35:1 respectively — just under the 4.5:1 AA threshold for this 12px caption-sized text. The `success`/`warning` variants pass comfortably (6.73:1/7.10:1); only these two fall short, and only in dark mode.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: "Accessibility score remains an engineering target rather than a hard release gate. Remaining exceptions, if any, shall be documented as Technical Debt." The gap is narrow (3–4% short), confined to a 12px caption element that never conveys status by color alone (every Badge usage pairs the color with a real text label — "FAILED"/"ERROR"/etc.), and closing it properly requires either inventing a new intermediate color stop (the `danger`/`info` scales only define 50/500/700, unlike `neutral`/`brand`'s full 50–900 range) or shifting dark-mode badge text to a different, less semantically "danger-red"/"info-blue" shade — both real design decisions, not a one-line fix, and disproportionate to the size of the gap.

**Closing this out looks like:** either add `danger-400`/`info-400` stops to `tailwind.preset.ts` (computed to land ≥4.5:1 against `neutral-900` at the same 10% tint) and use them for dark-mode `Badge` text specifically, or bump the dark-mode tint's opacity in the _opposite_ direction confirmed during this volume's audit (lower opacity keeps the background closer to `neutral-900`'s very low luminance, preserving contrast against the lighter text — raising it, counter-intuitively, reduces contrast since it pulls the background luminance toward the text's own hue).

**Trigger to revisit:** a broader dark-mode design-token pass, or a real accessibility complaint/audit finding tied to this specific pairing.

---

## TD-052 — Public Website has no real SEO content (infrastructure only)

**Raised:** 2026-08-12 (FRD-001 Volume-9, Performance/Accessibility/PWA)
**Status:** Open

**What:** `apps/web`'s `(public)/page.tsx` is still the exact FRD-001 Volume-1 placeholder ("Marketing content ships with the Public Website module... built when the Public Website module begins, per the approved Module Development Order," PRD-008 Vol 2 §4) — no real marketing page, blog, pricing page, or any other public-facing content exists yet. This volume built the SEO _mechanism_ only: a `generateMetadata`/static-`metadata` convention (demonstrated on the root layout's Open Graph/Twitter defaults, deliberately not forced onto the placeholder page itself — see below), `robots.ts` (disallows every authenticated route, allows `/`), and `sitemap.ts` (lists exactly the one real public URL that exists today).

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: "SEO scope is infrastructure only. Per-page marketing SEO remains deferred until the Public Website module exists." Fabricating per-page marketing copy/metadata for the placeholder page was explicitly rejected during this volume's own implementation — it would need to be entirely redone once real content ships, and risks misrepresenting a Phase-1 scaffolding page as real marketing content in search results.

**Closing this out looks like:** when the Public Website module (PRD-008 Vol 2) ships real pages, each one adds its own `generateMetadata`/`metadata` export following the convention `app/layout.tsx` already establishes (title/description/OG/Twitter), and `sitemap.ts` grows one entry per real page.

**Trigger to revisit:** the Public Website module beginning implementation, per SDP-001's Module Development Order.

---

## TD-053 — CRM Pipeline Kanban board has an unbounded, unvirtualized 200-deal client-side fetch

**Raised:** 2026-08-12 (FRD-001 Volume-9, Performance/Accessibility/PWA — originally built FRD-001 Volume-5)
**Status:** Open

**What:** `pipeline-board.tsx` fetches `dealService.list({page: 1, limit: 200})` and groups the full result client-side into 6 Kanban columns — no server-side pagination per column, no client-side virtualization. A workspace with more than 200 open deals silently truncates the board (deals beyond the 200th in list order never appear), and every one of the 200 deals is held in memory and re-grouped (now memoized as of this volume — see `docs/ADR-FE-017-production-frontend-strategy.md`) regardless of how many are actually visible in the viewport at once.

**Why accepted for now:** Resolved 2026-08-12, Architecture Review: "Existing scalability observations remain documented... remain Technical Debt rather than architectural changes." This is a pre-existing condition from Volume-5, not introduced by this volume — this volume's own contribution was fixing the _re-render_ cost (memoizing the grouping) without addressing the underlying _fetch-size_ ceiling, which is a genuine architectural change (server-side per-column pagination, or a "load more" pattern per column) out of scope for a hardening-only volume.

**Closing this out looks like:** either a dedicated pipeline endpoint that paginates per-stage server-side, or client-side virtualization (e.g. `@tanstack/react-virtual`, not currently installed anywhere in this repo) if the 200-item fetch itself is kept but rendering needs to scale further.

**Trigger to revisit:** a real customer workspace approaching or exceeding 200 concurrently-open deals, or a support report of deals "missing" from the Pipeline view.

---

## TD-054 — PWA scope is `apps/web`-only; deeper PWA capabilities are unbuilt

**Raised:** 2026-08-12 (FRD-001 Volume-9, Performance/Accessibility/PWA)
**Status:** Open

**What:** Per the Architecture Review's explicit scope decision, `apps/admin` has no manifest, service worker, or install experience — it remains a standard authenticated console. Within `apps/web`'s own PWA implementation, several capabilities named in FRD-001 Volume-9's planning document are explicitly out of scope for this volume (§14 "Out of Scope") or simply not built: Push Notifications, Background Sync/Periodic Background Sync (no offline mutation queueing of any kind — BR-005 forbids offline mutations entirely, so this may never be needed), and any richer install-prompt UX beyond the current single dismissible toast (e.g. an in-app "Install" menu item independent of the browser's `beforeinstallprompt` timing).

**Why accepted for now:** Resolved 2026-08-12, Architecture Review — apps/admin's exclusion is a direct, explicit scope decision (it "remains a standard authenticated administration console"), and Push Notifications/Background Sync were named Out of Scope in the FRD's own §14 from the start, not discovered gaps.

**Closing this out looks like:** a dedicated future FRD volume (or extension of this one) if a real product need for cross-tenant push notifications, background sync, or an `apps/admin` install experience emerges — none is anticipated given `apps/admin`'s internal-only, always-online operator-console nature.

**Trigger to revisit:** a real product requirement for any of the above — none currently exists.

---

## TD-055 — `ApiKeyGuard` is fully built but wired to zero routes

**Raised:** 2026-08-12 (PHD-001 Volume-1, Security Hardening)
**Status:** Open — classified, not expanded

**What:** `apps/api/src/modules/identity/guards/api-key.guard.ts` + `services/api-key.service.ts` are a complete, correctly-implemented `x-api-key` header authentication path — bcrypt-hashed key storage (`PasswordService.compare`, same one-way hashing as user passwords), prefix-indexed lookup so the raw key is never queried directly, expiry checking, and a shown-once raw key at creation (PRD-006 Volume-3 §4.4's Developer API Keys feature). It is not registered as a global guard and `@UseGuards(ApiKeyGuard)` is not applied to any controller route — grep-confirmed zero call sites. There is currently no Developer API surface (no endpoints meant to be called by anything other than the two frontend apps) for it to protect.

**Classification (PHD-001 §8 framework):** the guard/service implementation itself is **Already Secure** — reviewed line-by-line this volume, no hardening gap found in what's built. The dormancy itself is **Technical Debt**, not a security gap: an unwired guard grants no access to anything (the opposite of a vulnerability), it is simply finished work with no current consumer.

**Why accepted for now:** Architecture Review, this volume: reviewed and classified without expanding the approved API surface — building a Developer API surface for this guard to protect is a separate, larger product decision (a genuine external API product), not a hardening-volume task.

**Closing this out looks like:** either wire it to real routes once a Developer API surface is approved and built (PRD-006 §12 territory), or, if no such surface is ever planned, remove the dormant guard/service pair entirely rather than carry unused code indefinitely.

**Trigger to revisit:** a Product decision to ship a customer-facing Developer API (webhooks-out, programmatic access, etc.).

---

## TD-056 — No SBOM generation or container image signing anywhere in the build/deploy pipeline

**Raised:** 2026-08-13 (PHD-001 Volume-1, Security Hardening)
**Status:** Open — documented gap, deferred to Docker/CI-CD scope

**What:** No Software Bill of Materials is generated for any built Docker image, and no image-signing mechanism (e.g., Sigstore/`cosign`) exists anywhere in `docker/` or the CI pipeline. Confirmed during this volume's own Docker/CI-CD/supply-chain research — a genuine, currently-unaddressed gap, not something already covered by an existing control.

**Why accepted for now:** PHD-001 Volume-1's approved scope was application-layer security hardening (auth/cookies/HTTP headers/rate-limiting/JWT) — this document's own roadmap footer already names PHD-001 Volumes 2–4 as the sequence covering `apps/api`/Docker/CI-CD/Deployment Configuration specifically. Building an SBOM/signing mechanism means choosing a concrete tool and CI wiring, which is Docker/CI-CD infrastructure work, not an application-layer hardening task — see `docs/ADR-PHD-002-production-security-configuration.md` for the full reasoning.

**Closing this out looks like:** a future PHD-001 volume (or dedicated CI/CD hardening pass) selecting a concrete SBOM tool (e.g., `syft`) and signing mechanism (e.g., `cosign` keyless signing via the CI provider's OIDC identity), then wiring both into the existing Docker build/publish pipeline.

**Trigger to revisit:** the PHD-001 Volume-2 (or later) Docker/CI-CD/Deployment Configuration volume beginning.

---

## TD-057 — Pre-existing lint failures in 3 files, discovered during PHD-001 Volume-2's regression sweep

**Raised:** 2026-08-13 (PHD-001 Volume-2, Observability, Monitoring & Logging — full regression sweep)
**Status:** Open

**What:** `pnpm -r lint` fails on 3 files this volume never touched (confirmed via `git status` showing zero diff against `HEAD` for all three): `apps/api/src/common/security/refresh-cookie.service.spec.ts` (2× `@typescript-eslint/no-unsafe-assignment`, mock typing), `apps/api/src/modules/platform/services/platform-compliance.service.spec.ts` (1× `@typescript-eslint/no-unnecessary-type-assertion`), and `apps/api/test/platform-analytics-governance.e2e-spec.ts` (2× `@typescript-eslint/no-unsafe-enum-comparison`, 1× `@typescript-eslint/no-unsafe-member-access`). This means `pnpm -r lint` was already failing at the last commit (`8ee2ce0`, PHD-001 Volume-1) before this volume's own work began — either a lint-rule/dependency version drift after that commit was made, or the lint gate wasn't actually run as part of that commit's own lifecycle.

**Why accepted for now:** All 3 files belong to already-reviewed, frozen work (`refresh-cookie.service.spec.ts` is PHD-001 Volume-1 itself; `platform-compliance.service.spec.ts` and the e2e spec are Phase-8/PRD-007 Volume-4, frozen). Per this project's frozen-module governance, fixing them isn't folded silently into this volume's unrelated scope — the same reasoning already applied to TD-007. This volume's own new/modified files are confirmed fully lint-clean (`npx eslint` on every touched directory returns zero errors).

**Closing this out looks like:** a small, mechanical fix in each file — likely a properly-typed mock (`refresh-cookie.service.spec.ts`), removing the now-unnecessary type assertion (`platform-compliance.service.spec.ts`), and adding a shared enum type or narrowing the `any`-typed `.data` access before comparison (`platform-analytics-governance.e2e-spec.ts`) — plus confirming whether an `@typescript-eslint` version bump (or similar) is what changed the rule's strictness, so a root cause is understood rather than just the symptom fixed.

**Trigger to revisit:** the next approved maintenance/bug-fix pass touching any of these 3 files, or a dedicated lint-hygiene pass once this is flagged to the Architect.

**Still open (2026-08-17, PHD-001 Volume-3, Performance, Scalability & Production Infrastructure):** confirmed still the exact same 3 files, same rules, same line counts, via `pnpm --filter @wapp/api lint` and `pnpm --filter @wapp/{web,admin} lint` as part of this volume's own full regression sweep, cross-checked again against `git log`/`git status` (all 3 files unmodified since commits `8ee2ce0`/`7a63063`, both predating this volume). No new entry filed; this is the same gap, now confirmed from two independent volumes across two different lint-tooling states.

---

## TD-058 — Broadcast completion-status metric not instrumented (PHD-001 Volume-2)

**Raised:** 2026-08-13 (PHD-001 Volume-2, Observability, Monitoring & Logging)
**Status:** Open

**What:** `wapp_communication_broadcasts_total{status}` is instrumented at `BroadcastService.create()` (the `DRAFT`/`SCHEDULED` status at creation time) but not at broadcast completion — `BroadcastExecutionProcessor`'s completion path (mirroring `CampaignService.onBroadcastFinished()`'s `COMPLETED` increment, which _is_ instrumented) does not increment the same counter with a `COMPLETED`/`FAILED` status.

**Why accepted for now:** Scoped out for time during the "build all named metrics" implementation pass — the metric itself exists and is genuinely useful at creation time (broadcast volume/scheduling patterns), and adding the completion-status increment is a small, well-understood, additive change (same shape as `CampaignService`'s already-instrumented equivalent) rather than a design question, so it was deliberately deferred rather than rushed.

**Closing this out looks like:** add `this.metricsService.communicationBroadcastsTotal.inc({status})` to `BroadcastExecutionProcessor`'s completion/failure paths, mirroring `CampaignService.onBroadcastFinished()`'s existing pattern exactly.

**Trigger to revisit:** the next maintenance pass over `apps/api/src/modules/communication/queue/broadcast-execution.processor.ts`, or when Broadcast completion-rate dashboards are actually built and this gap becomes visible in practice.

---

## TD-059 — Data export queue retries are structurally inert

**Raised:** 2026-08-17 (PHD-001 Volume-3, Performance, Scalability & Production Infrastructure — BullMQ per-queue tuning pass)

**Status:** Open

**What:** Every sweep-driven BullMQ queue in this volume's approved scope (`retention-cleanup`, `subscription-lifecycle`, `invoice-lifecycle`, `support-session-lifecycle`, `conversation-auto-close`, `sla-escalation`) gained `attempts: 2, backoff: {type: "exponential", delay: 60_000}` on their `queue.add()` calls, justified by each sweep only ever operating on its own still-pending candidate set (safe to retry). `data-export`'s `queue.add()` (`apps/api/src/modules/settings/services/data-export.service.ts`) was deliberately left at its existing `{attempts: 1}` rather than receiving the same treatment: `DataExportProcessor.handle()` catches every error internally and never rethrows (it records the failure onto the `DataExport` document's own status field instead), which means any `attempts` value greater than 1 would be structurally inert — BullMQ only retries a job whose handler actually throws, and this one never does. Raising `attempts` here would look like a fix while changing nothing.

**Why accepted for now:** Discovered as an incidental nuance while tuning the other 10 queues, not something this volume's approved scope named — fixing the underlying error-swallowing behavior (making `handle()` rethrow on genuinely transient failures, e.g. a Cloudinary upload timeout, while still recording a terminal status for genuinely permanent ones) is a real behavior change to already-shipped Settings module code (PRD-006), not a config tweak, and needs its own scoped review rather than a silent change bundled into a BullMQ-tuning pass.

**Closing this out looks like:** `DataExportProcessor.handle()` distinguishes transient failures (network/timeout — rethrow, let BullMQ's `attempts`/`backoff` actually do something) from permanent ones (invalid export request shape — catch and record terminally, as today), then set `attempts`/`backoff` on `data-export`'s `queue.add()` to match, mirroring the other 10 queues' pattern.

**Trigger to revisit:** the next approved maintenance pass over `apps/api/src/modules/settings/services/data-export.service.ts`/`data-export.processor.ts`, or a real observed case of a transient export failure that a retry would have recovered from but didn't.

---

## TD-060 — Webhook-processing concurrency held at BullMQ's default (1) due to a check-then-act race

**Raised:** 2026-08-17 (PHD-001 Volume-3, Performance, Scalability & Production Infrastructure — BullMQ concurrency tuning pass; doubt-policy resolution)

**Status:** Open

**What:** All 11 BullMQ processors in this volume's approved scope received an explicit `concurrency` value except `webhook-processing.processor.ts`, which was deliberately kept unset (BullMQ's default, 1) after discovering `WebhookService.handleInboundMessage()` performs a check-then-act sequence on `waMessageId` (look up whether a message with this Meta-supplied id already exists, then insert if not) without an atomic, unique-index-backed upsert. Under concurrency > 1, two jobs processing near-simultaneous webhook deliveries for the same `waMessageId` (a real, documented possibility — Meta's own webhook delivery guarantees are at-least-once, not exactly-once) could both pass the "not found" check before either inserts, producing a duplicate message record.

**Why accepted for now:** Resolved via the doubt policy mid-implementation (not a pre-scoped item) as "keep concurrency unset, log as Technical Debt" rather than either (a) shipping concurrency=10 with a latent duplicate-processing bug, or (b) redesigning the insert path's concurrency-safety inside what was meant to be a config-tuning pass, not a data-integrity fix — the mandatory verification condition ("no queue tuning may silently introduce duplicate processing") explicitly required surfacing this rather than deciding it silently either way.

**Closing this out looks like:** add a unique index on `waMessageId` (scoped per workspace/connection, matching how the rest of this schema scopes uniqueness) and change the insert path to a single atomic upsert (`findOneAndUpdate` with `upsert: true`, or an insert wrapped to catch and swallow the resulting duplicate-key error) instead of separate find-then-insert calls — once that's in place, `concurrency` can be safely raised on this processor the same way it was on the other 10.

**Trigger to revisit:** the next approved maintenance pass over `apps/api/src/modules/communication/services/webhook.service.ts`/`webhook-processing.processor.ts`, or real measured evidence that concurrency=1 is an actual inbound-message-processing bottleneck (not yet observed — this volume's k6 testing exercised `/api/health` and `/api/v1/auth/register`, not the webhook path, so no load data exists for this queue specifically).

---

## TD-061 — Redis-backed throttler shares BullMQ's unbounded-retry connection, no bounded command timeout on the request-path check

**Raised:** 2026-08-17 (PHD-001 Volume-3, Performance, Scalability & Production Infrastructure — k6 stress-test finding; doubt-policy resolution)

**Status:** Open

**What:** The global `REDIS_CLIENT` (`apps/api/src/infrastructure/redis/redis.module.ts`) is configured with `maxRetriesPerRequest: null` — correct and, per BullMQ's own documentation, required for its Workers' blocking-command semantics — and is reused by `RedisThrottlerStorageService` (this volume's own Infra #13 work) for the synchronous `ThrottlerGuard` check that runs on every HTTP request. `maxRetriesPerRequest: null` means a Redis command that can't complete queues indefinitely rather than failing after a bounded number of attempts; on the hot HTTP request path, this means a throttle check — which should fail fast — can instead block the entire request behind it if Redis has any transient slowness. Directly implicated in a k6 stress-test finding: 400 concurrent simulated clients against `/api/health` (an endpoint with zero Mongo/Redis I/O of its own) produced a 21.25% failure rate and a max observed request latency of 43m38s, consistent with throttle-check commands queuing behind Redis contention rather than timing out.

**Why accepted for now:** Resolved via the doubt policy immediately after the stress-test finding — the storage/keying logic `RedisThrottlerStorageService` implements is correct and already verified (per-client rate-limit buckets confirmed independent via direct testing); this is a distinct concern about the _connection_ it shares with BullMQ, and separating them (or adding a bounded per-command timeout) is a real architectural change to already-shipped Infra #13 work, not a same-volume patch on a single stress-test data point. It also only manifests at concurrency levels (hundreds of distinct simultaneous clients/second) far beyond WAPP's current beachhead-stage expected traffic.

**Closing this out looks like:** give `RedisThrottlerStorageService` its own Redis connection, separate from the one injected into BullMQ's queue/worker registrations, configured with a finite `maxRetriesPerRequest` (or an explicit per-command timeout via `commandTimeout`) so a throttle check fails fast and lets the request proceed in a fail-open (or fail-closed, needs its own decision) manner under genuine Redis pressure, rather than hanging indefinitely. Should be validated by re-running the same 400-VU stress scenario (`k6/scenarios/stress.js`) afterward and confirming both the failure rate and the tail-latency shape improve.

**Trigger to revisit:** real production traffic approaching the concurrency level where this was observed (400+ distinct simultaneous clients/second), or a dedicated Redis-infrastructure hardening pass — whichever comes first. Not a pre-launch blocker at WAPP's current expected beachhead-stage scale.

---

## TD-062 — No automated CD, container registry, or staging environment

**Raised:** 2026-08-17 (PHD-001 Volume-4, Release Readiness, CI/CD & Deployment — Architecture Review, formally resolved decisions)

**Status:** Open

**What:** This volume's CI pipeline (`.github/workflows/ci.yml`) verifies every PR/push (lint, typecheck, test, build, Docker build+healthcheck, e2e, security audit) but deploys nothing — production deployment is a human executing `docs/RELEASE-RUNBOOK.md` on the Hostinger VPS. There is no container registry (every deploy rebuilds all three images from source, directly on the VPS, from whatever commit/tag is checked out) and no staging/Release-Candidate environment (Release Candidate verification uses the same local Docker build/run/smoke-test approach PHD-001 Volume-3 established, immediately before a direct production deploy — not a second, permanently-provisioned environment). A related, adjacent proposal — migrating `apps/web`/`apps/admin` to Vercel and `apps/api` to Render — was also considered and explicitly declined for this volume.

**Why accepted for now:** All three were explicit, formally resolved Architecture Review decisions, not oversights. Given the single-VPS Hostinger topology (TAD-001 DEP-001/002/003), zero existing deploy-credential or registry infrastructure, and this project's repeated discipline of not introducing infrastructure without evidence it's needed (the same reasoning already applied to deferring PHD-001 Volume-3's Worker/API process split), automating deployment, adding a registry, or standing up a second environment now would each be a materially larger commitment than "harden the release process for what already exists" — which is this volume's actual, approved scope.

**Closing this out looks like:** three independent, separately-approvable initiatives, not one bundled change — (1) CI gains scoped deploy credentials (SSH to the VPS, or a registry-push token) and an explicit deploy job, once the operational maturity/team size justifies removing the human-executed step; (2) a container registry (GitHub Container Registry is the natural first choice, given GitHub Actions is already in use) if/when "rebuild from source on every deploy" becomes a measured pain point (build time, deploy-window length) rather than a theoretical one; (3) a real second environment (a second, smaller VPS, or a staging profile on existing infrastructure) if/when pre-production verification against the exact production topology (not just local Docker) becomes a genuine, evidenced need. The Vercel/Render hosting question, if revisited, needs its own formal TAD-001 amendment given its ripple effects into `apps/web`'s cookie-security architecture (ADR-PHD-001) and PHD-001 Volume-3's already-frozen resource-limit/nginx-routing work — not a decision to fold into any of the three items above.

**Trigger to revisit:** a real, measured operational cost from the current manual process (deploy frequency high enough that the human-executed runbook becomes a genuine bottleneck), or a dedicated infrastructure-scaling initiative — whichever comes first. Not a pre-launch blocker at WAPP's current single-operator, single-VPS scale.

---

## TD-063 — No MongoDB migration-runner tooling

**Raised:** 2026-08-17 (PHD-001 Volume-4, Release Readiness, CI/CD & Deployment — Architecture Review, formally resolved decision)

**Status:** Open

**What:** No migration framework (e.g. `migrate-mongo`) exists anywhere in this codebase. Every schema/index change across the entire engagement to date has been an implicit, additive Mongoose schema change applied at boot, with no versioned migration files and no formal rollback-migration concept. PHD-001 Volume-4 formalized the existing discipline as a documented Expand → Deploy → Migrate → Contract policy (`docs/ADR-PHD-008-production-deployment-rollback-strategy.md`) and made index creation an explicit tracked release-checklist item, rather than introducing new tooling.

**Why accepted for now:** Resolved via the doubt policy during Volume-4's Architecture Review — matching this project's repeated precedent of not adopting new infrastructure without evidence it's needed (the same reasoning as TD-062, above). This codebase's migration history to date has been small, additive, and manageable without a formal runner; introducing one now would mean retroactively formalizing history that was never tracked that way, for a problem (destructive, hard-to-coordinate schema changes) that hasn't actually occurred yet.

**Closing this out looks like:** adopt a real migration tool (`migrate-mongo` is the natural fit given this codebase already uses Mongoose) once a genuinely destructive or multi-step schema change is actually needed — at that point, retroactively capture the current schema state as migration "zero" and require all subsequent schema changes to go through versioned migration files instead of implicit boot-time Mongoose changes.

**Trigger to revisit:** the first schema change that is genuinely destructive (a field removal/type change affecting existing production documents) or that requires careful multi-step coordination with a deploy — the Expand/Deploy/Migrate/Contract discipline alone stops being sufficient once a change can't safely be expressed as "additive, then later contracted in a separate release."
