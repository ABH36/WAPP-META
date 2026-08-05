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
