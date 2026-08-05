# Incident: `Types.ObjectId` vs `SchemaTypes.ObjectId` — ObjectId ref fields silently stored as strings since Phase 2

**Date found:** 2026-08-05 (during Phase-4 Part 3b-i, Broadcast Management)
**Severity:** High (silent, codebase-wide, since Phase 2) — **Status: Fixed**
**Found by:** an e2e test assertion failure (`BroadcastRecipientRepository.getStats`'s aggregate returned zero rows for a real, existing Broadcast)

## What was wrong

Every Mongoose schema field declared as `@Prop({ type: Types.ObjectId, ref: "...", ... })` — using `Types.ObjectId` imported from `"mongoose"` — was **not actually being cast to a real BSON ObjectId on write**. Assigning a valid ObjectId-format string to the field just stored the string as-is. This affected 18 fields across 10 schema files, going back to Phase 2 (Identity's `AuthToken.userId`, `Session.userId`) through Phase 3 (Workspace's `Workspace.ownerId`, `WorkspaceInvitation.workspaceId`/`invitedBy`) and every Communication schema built since (`Contact`/`PhoneNumber`/`Conversation`/`Message`/`Template`/`Broadcast` ref fields).

## Why it was invisible until now

Almost every query path in the codebase uses `Model.find()`/`findOne()`/`findOneAndUpdate()`, which auto-cast the _query condition_ to match the schema's declared field type regardless of what's actually stored — so a string-vs-string comparison (query cast to ObjectId... but actually also not cast, since the schema path itself wasn't recognized as ObjectId — see root cause) just happened to match consistently, because both the write side and the read side were equally "wrong" in the same way. `.populate()` also tolerated it (Mongoose's populate builds its own `$in` query independent of the local field's actual stored type). The **first** code path in the project to depend on the field genuinely being a real ObjectId was `BroadcastRecipientRepository.getStats()`'s raw `aggregate()` pipeline — `$match` stages don't go through Mongoose's query-casting layer at all, so `{ $match: { broadcastId: new Types.ObjectId(broadcastId) } }` correctly built a real ObjectId to match against, while the stored `broadcastId` values were plain strings — a genuine BSON type mismatch, zero results.

## Root cause

`mongoose.Types.ObjectId` (the BSON value class, used for `new Types.ObjectId()`) is **not the same thing** as `mongoose.Schema.Types.ObjectId` / `mongoose.SchemaTypes.ObjectId` (the SchemaType class Mongoose's schema builder actually expects in a `type:` option). `@nestjs/mongoose`'s `DefinitionsFactory.inspectTypeDefinition()` checks whether a given `type` value is a recognized primitive or a `mongoose.SchemaType` subclass; `Types.ObjectId` is neither (it _is_ a class, so the "is this a nested `@Schema()`-decorated class" branch runs, finds no metadata for it, and silently resolves to an empty object `{}}` as the field's type — Mongoose then treats the path as untyped/no-cast, so whatever JS value is assigned is stored unchanged).

Confirmed via an isolated reproduction: `new mongoose.Schema({ foo: { type: mongoose.Types.ObjectId } })` recognizes `foo` as an ObjectId path and casts correctly when using **plain Mongoose** directly; the exact same `type: Types.ObjectId` value passed through `@nestjs/mongoose`'s `@Prop()`/`SchemaFactory.createForClass()` does not.

## Fix

Replaced every `type: Types.ObjectId` with `type: SchemaTypes.ObjectId` (importing `SchemaTypes` from `"mongoose"` — equal to `mongoose.Schema.Types`, aliased to avoid colliding with `@nestjs/mongoose`'s own `Schema` decorator import already present in every affected file) across all 18 occurrences:

- `apps/api/src/modules/identity/schemas/{auth-token,session}.schema.ts`
- `apps/api/src/modules/workspace/schemas/{workspace,workspace-invitation}.schema.ts`
- `apps/api/src/modules/communication/schemas/{whatsapp-connection,phone-number,contact*,conversation,conversation-note,message,template,broadcast,broadcast-recipient}.schema.ts`

The TypeScript field type annotations (`userId!: Types.ObjectId`, etc.) were already correct and unchanged — only the runtime `@Prop()` option was wrong.

## Impact assessment

- **No production data existed** (Phase 1 hasn't launched) — the dev/test databases holding string-typed legacy values are disposable; no migration was needed or performed.
- **No functional regression in already-shipped behavior**: every existing `find()`-based query path continued working identically before and after the fix (confirmed by the full unit + e2e suite passing unchanged), because those paths never depended on the underlying BSON type. The bug was latent, not previously causing any incorrect behavior visible through the API.
- **Newly written code should be more predictable going forward**: any future raw `aggregate()` pipeline, `.lean()` read followed by manual type assumptions, or cross-collection `$lookup` will now see real ObjectId values, matching what the schema always claimed.

## Verification

Full sweep after the fix: typecheck, lint, build — clean. 141 unit tests, 49 e2e tests (against live Docker Mongo/Redis) — all passing, re-run twice for stability. Manually confirmed via direct `mongosh` inspection that a newly created `Broadcast.templateId` and `BroadcastRecipient.broadcastId` are now stored as real `ObjectId` BSON values (`$type: "objectId"`), not strings.

## Why this wasn't caught earlier

Same category as the two Part-1/Part-3 lessons already on record (the Mongoose nested-schema `@Schema()` bug, the shared-types runtime-execution bug): **typecheck, lint, build, and mocked unit tests cannot catch a real Mongoose schema-compilation or casting defect** — only reading actual persisted documents back from a live database exposes it. This one went further than those two because raw `aggregate()` pipelines — the one code path that would have surfaced it — hadn't been written anywhere in the project until this exact feature (Broadcast stats). Worth normalizing as a standing check: any future feature introducing the _first_ aggregate pipeline, `$lookup`, or raw driver query against an existing collection should include a live-data sanity check of the underlying BSON types, not just a `find()`-based smoke test.
