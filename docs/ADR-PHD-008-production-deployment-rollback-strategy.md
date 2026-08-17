# Production Deployment & Rollback Strategy

**Status:** Accepted
**Date:** 2026-08-17
**Scope:** PHD-001 Volume-4 (Release Readiness, CI/CD & Deployment) — deployment topology, ordering, health verification, rollback, database migration safety, and disaster-recovery readiness. See `docs/ADR-PHD-007-release-cicd-strategy.md` for the CI-pipeline and versioning half of the same volume.
**Implemented in:** `docs/RELEASE-RUNBOOK.md`, `docs/RELEASE-CHECKLIST.md`, `docker-compose.prod.yml`

## Deployment topology: this codebase's actual shape, not the planning document's generic one

PHD-001 Volume-4's own planning document proposes a deployment ordering of `Infrastructure → Database/Indexes → Redis → API → Workers → Web → Admin → Nginx → Smoke Tests` — written generically, before this repository's own architecture was accounted for. Two corrections, both already-frozen decisions from earlier volumes, not new ones:

- **"API" and "Workers" are the same process, not two deployable units.** PHD-001 Volume-3's Architecture Review explicitly resolved to keep a single-process topology ("Do NOT introduce a separate worker deployment/process topology in this volume unless... Keep the current process topology for now") — every BullMQ processor runs inside the one `apps/api` container. There is no separate "Workers" step to order; deploying `api` deploys both.
- **MongoDB is external Atlas, not a deployed component.** "Database" in the generic ordering doesn't mean deploying Mongo itself (it already runs, independently, in Atlas) — it means verifying connectivity and running any pending index/migration work (see below) before the API that depends on it comes up.

**The actual, verified sequence:**

```
Hostinger VPS (already running)
      ↓
Verify MongoDB Atlas connectivity + apply any pending indexes (Expand step, if any)
      ↓
Redis (docker compose up -d redis)
      ↓
API — includes all BullMQ workers, single process (docker compose up -d --build api)
      ↓
Web (docker compose up -d --build web)
      ↓
Admin (docker compose up -d --build admin)
      ↓
Nginx (docker compose up -d --build nginx — depends_on: condition: service_healthy
       on all three apps already gates this correctly, per PHD-001 Volume-3)
      ↓
Health verification + smoke tests
```

`docker-compose.prod.yml`'s existing `depends_on: condition: service_healthy` (PHD-001 Volume-3) already encodes most of this ordering structurally — `docker compose up -d` on the full stack mostly self-orders correctly. The Release Runbook documents the sequence explicitly anyway, since a partial/rolling deploy (e.g., redeploying only `api` after a hotfix) needs the ordering spelled out, not inferred from the compose file's dependency graph alone.

## Rollback: rebuild from a known-good commit, not an image cache

No container registry exists (ADR-PHD-007) — every deploy is `docker compose build` against whatever the VPS's git checkout currently has. Rollback is therefore **not** "redeploy a previous cached image"; it's:

```
Identify last known-good release tag (git tag -l, or the Release Checklist's own record)
      ↓
git fetch --tags && git checkout <previous-tag>
      ↓
docker compose -f docker-compose.prod.yml up -d --build
      ↓
Health verification + smoke tests
      ↓
Monitor
```

This is slower than an image-registry-based rollback (a full rebuild, not a pull), but it's consistent with the "no registry" decision and this platform's current scale — a full `docker build` for all three images takes low single-digit minutes based on PHD-001 Volume-3's own build timings, not a meaningfully long outage window for a single-VPS deployment.

**Database rollback is a separate concern from application rollback, never automatic (§26 BR-006).** If a release included a destructive schema change, rolling back the application code does **not** un-migrate the database — per the Expand→Deploy→Migrate→Contract discipline below, a destructive change should only ever reach the Contract phase once the Expand/Deploy phases have been running successfully for a real observation period, specifically so an application-only rollback remains safe without needing a reverse migration at all.

## Database migration strategy: formalizing existing discipline, not adopting new tooling

No migration framework (`migrate-mongo` or similar) exists anywhere in this codebase — every schema/index change across the entire engagement to date has been an implicit, additive Mongoose schema change applied at boot. The Architecture Review resolved to formalize this existing lightweight discipline rather than introduce new tooling, matching this project's own repeated precedent of not adding infrastructure without evidence it's needed.

**Expand → Deploy → Migrate → Contract, applied to this codebase specifically:**

1. **Expand** — add the new field/index/collection alongside the old shape; old code paths keep working unchanged. Mongoose schema changes are additive by construction unless a field is explicitly removed.
2. **Deploy** — ship the application code that can read/write both the old and new shape.
3. **Migrate** — backfill existing documents to the new shape, if needed (a one-off script, run manually against production — this codebase has no automated migration-runner to do this for you, by this volume's own explicit decision).
4. **Contract** — only once the new shape has been running successfully in production for a real observation period, remove the old field/code path in a later, separate release.

**Index creation is now an explicit, tracked release-checklist item** (`docs/RELEASE-CHECKLIST.md`), not an implicit side effect of deploying new code — MongoDB index builds on a large collection can be a genuine production operation (locking/performance impact depending on Atlas tier and collection size), and treating it as "just part of the deploy" was never accurate.

## Atlas backup: a fact outside this repository, not something this volume verifies

Production MongoDB is Atlas (external SaaS, `docker-compose.prod.yml`'s own existing comment) — its backup configuration, retention window, and restore history live entirely in the Atlas console, not in this repository or any file this codebase controls. The Architecture Review resolved this as a **documented pending manual-confirmation item**, not something to be verified or configured programmatically: the Release Checklist carries a line item for the Architect/Product Owner to confirm directly (backup exists, last completed successfully, retention window known, a restore has actually been tested at least once) rather than this document asserting a status that can't be checked from code.

## Disaster recovery: exercised, not just documented

§38 explicitly requires at least one controlled recovery exercise be **performed**, not just described. Executed this volume against the same local Docker infrastructure PHD-001 Volume-3 already built and verified (container restart, redeploy of a previous artifact/tag) — see the Performance section of `docs/RELEASE-RUNBOOK.md` for the actual exercise performed and its results, since claiming disaster-recovery readiness from documentation alone is exactly what this section's own wording warns against.

## What was deliberately not built

- **No real staging environment.** Release Candidate verification uses the same local Docker build/run/smoke-test approach already proven in PHD-001 Volume-3, immediately before a direct production deploy — not a second, permanently-provisioned environment.
- **No production configuration-drift detection tooling.** Would require either a secrets manager (not adopted — this project continues on plain, never-committed `.env` files, the practice already used across three prior PHD volumes without objection) or a bespoke comparison script; neither was built, given no evidence yet that manual `.env` drift has actually been a problem on a single-operator, single-VPS deployment.
