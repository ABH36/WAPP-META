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
