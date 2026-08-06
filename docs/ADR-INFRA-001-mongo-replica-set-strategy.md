# INFRA-001 — Mongo Replica Set Strategy

**Status:** Accepted
**Date:** 2026-08-06
**Raised by:** Architecture Review (PRD-004 Volume-3 recommendation #3)
**Implemented in:** `docker-compose.yml`, `apps/api/.env.example`

## Why this was needed

PRD-004 Volume-3 (Lead Conversion) BR-008 requires conversion to run inside a single database transaction (Customer creation, Deal creation, and Lead update all succeed or all roll back together). MongoDB multi-document transactions require the server to be a replica set member — they are not available on a standalone `mongod` at all, and attempting one throws immediately. Verified before this change: `docker-compose.yml`'s dev `mongo` service ran as plain standalone Mongo (no `--replSet` flag), and there was zero existing transaction usage anywhere in this codebase. `database.module.ts`'s own comment already states production uses MongoDB Atlas, which is always a replica set — so this was a dev/test-infrastructure gap specifically, not a production one: BR-008 would have worked in prod and thrown at runtime against local Docker Mongo, the exact environment this project's e2e-test discipline (real Docker Mongo/Redis, never mocked) depends on.

## What changed

`docker-compose.yml`'s `mongo` service now starts with `--replSet rs0 --bind_ip_all`. A new one-shot `mongo-init` service (same `mongo:7` image) waits for `mongo` to accept connections, then runs `rs.initiate()` — idempotently: `rs.status()` succeeding on a later `docker-compose up` means the replica set was already initiated, and the script skips re-initiation rather than erroring. `MONGODB_URI` (`.env.example` and local `.env`) gained `?replicaSet=rs0`.

## The gotcha this ADR exists to prevent repeating

The first `rs.initiate()` attempt registered the replica set member as `mongo:27017` — the hostname other **containers** on the compose network would use to reach it. That's wrong here: per `docker-compose.yml`'s own top comment, `apps/api` (and `web`/`admin`) run directly on the **host** machine via `pnpm dev:*`, not inside this compose network, and only ever reach Mongo through its published port on `localhost`. The driver connects to the seed address fine initially, but once it learns the replica set's topology, it reconnects to whatever hostname the replica set config itself reports for the primary — `mongo:27017`, which the host machine's DNS cannot resolve (`getaddrinfo ENOTFOUND mongo`), breaking every connection after the first handshake.

**Fixed by registering the member as `localhost:27017` instead** — matching how the sole consumer (the host-run API) actually connects. `mongo-init`'s `rs.initiate()` call and this document both reflect the corrected value. If a containerized consumer (e.g. a future `docker-compose.prod.yml`-style local stack) is ever added, it would need this reconsidered — a containerized caller can't resolve `localhost:27017` as _this_ Mongo either, for the same reason in reverse.

## What this ADR does not do

Doesn't touch `docker-compose.prod.yml` (no local Mongo service there at all — production is real Atlas, already a replica set, no `mongo-init`-style bootstrapping needed or present). Doesn't add retry/backoff tuning for transaction-specific errors (`TransientTransactionError`/`UnknownTransactionCommitResult`) — `docs/ADR-CRM-009-lead-conversion-strategy.md` covers how `LeadConversionService` uses the resulting transaction capability.
