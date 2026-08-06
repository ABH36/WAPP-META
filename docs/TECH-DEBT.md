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
