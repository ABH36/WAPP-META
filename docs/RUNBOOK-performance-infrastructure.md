# Operational Runbook — Performance & Production Infrastructure

**Scope:** PHD-001 Volume-3 deliverable. Practical, "when X happens, do Y" procedures for operating production capacity — resource limits, MongoDB/Redis pressure, queue backlog, container health, and startup failures. Not a design explanation (see `docs/ADR-PHD-005-performance-scalability-strategy.md`/`docs/ADR-PHD-006-production-infrastructure-strategy.md` for the "why"); not a repeat of `docs/RUNBOOK-observability-operations.md` (correlation-ID tracing, `/metrics` reading, queue-health dashboards — start there for diagnosis, come here for capacity/infrastructure response).

## Container resource limits at a glance

| Service | CPU default | Memory default | Override env var                         |
| ------- | ----------- | -------------- | ---------------------------------------- |
| `api`   | 2.0         | 512M           | `API_CPU_LIMIT` / `API_MEMORY_LIMIT`     |
| `web`   | 0.5         | 256M           | `WEB_CPU_LIMIT` / `WEB_MEMORY_LIMIT`     |
| `admin` | 0.5         | 256M           | `ADMIN_CPU_LIMIT` / `ADMIN_MEMORY_LIMIT` |
| `redis` | 0.5         | 256M           | `REDIS_CPU_LIMIT` / `REDIS_MEMORY_LIMIT` |
| `nginx` | 0.25        | 128M           | `NGINX_CPU_LIMIT` / `NGINX_MEMORY_LIMIT` |

All are `deploy.resources.limits` in `docker-compose.prod.yml`, confirmed to apply under plain `docker compose up` (no Swarm required — see ADR-PHD-006). Override via a `.env` file in the same directory as the compose file, or exported shell variables before `docker compose up -d`. Changing a limit requires recreating the container (`docker compose up -d --force-recreate api`), not just a restart.

**`api`'s `2.0` default is evidence-based, not a guess** — see `docs/PERF-REPORT-phd001-volume3.md`'s CPU evidence trail. If bumping it further, re-run `k6/scenarios/load.js` afterward and compare against that report's numbers before assuming the change helped.

## High CPU on the API container

1. Confirm it's real: `docker stats <api-container>` — sustained near-100%-of-limit CPU, not a brief spike.
2. Check what's driving it. Concurrent `bcrypt` work (registration/login bursts) is the most likely known cause — cross-reference request volume on `/api/v1/auth/{register,login}` around the same window (access logs, or `wapp_http_requests_total` from `/metrics` if instrumented per-route). A registration/login burst causing multi-second latency is the exact, expected, already-measured behavior at low CPU allocation — see the Performance Report's CPU evidence trail before treating this as a new bug.
3. If it's a genuine registration/login burst and 2.0 CPU is saturating: raise `API_CPU_LIMIT` (4.0 was the highest value tested this volume, at diminishing but real returns — see the Performance Report) and recreate the container. This is a capacity response, not a code fix — bcrypt's cost factor (12) is a deliberate security default and should not be lowered to chase CPU headroom.
4. If CPU is high with no corresponding auth traffic, suspect a queue backlog (see below) or an infinite-loop-shaped bug — check `wapp_queue_job_*` metrics and recent deploys before assuming it's load-related at all.

## High memory on the API container

1. `docker stats` — check against the `512M` (or overridden) limit. A container approaching its memory limit will eventually get OOM-killed by the kernel (`docker inspect <container> --format '{{.State.OOMKilled}}'` confirms after the fact).
2. Check `/settings/diagnostics`'s `cache` field (via `docs/RUNBOOK-observability-operations.md`'s guidance) — Redis memory growth from under-retained completed/failed BullMQ jobs is a plausible contributor if a queue's `removeOnComplete`/`removeOnFail` counts were changed without re-checking retention math.
3. Node's own heap growth under sustained high request volume is expected to some degree; a steady climb that never plateaus (not just a sawtooth from GC) is worth a heap snapshot before assuming a limit increase is the right answer — raising the limit masks a leak rather than fixing one.

## MongoDB slow / connection pool exhausted

Pool defaults: `MONGO_MAX_POOL_SIZE=10`, `MONGO_MIN_POOL_SIZE=2`, `MONGO_CONNECT_TIMEOUT_MS=10000`, `MONGO_SOCKET_TIMEOUT_MS=45000`, `MONGO_SERVER_SELECTION_TIMEOUT_MS=10000` — all overridable via the same-named env vars, all read once at boot (`database/database.module.ts`), never hot-reloadable.

1. `wapp_infra_dependency_up{dependency="mongodb"}` at `0`, or `/api/health` reporting `"degraded"` → the driver has lost the connection entirely, not just running slow queries. Check network path to Mongo (Atlas, in production) before anything else.
2. Requests hanging (not erroring) under concurrent load → likely pool exhaustion, not a down database. `maxPoolSize=10` is deliberately conservative; if genuinely legitimate concurrent traffic exceeds it, raise `MONGO_MAX_POOL_SIZE` and restart — do this from evidence (a metrics/logs correlation showing queueing at exactly 10 concurrent operations), not preemptively.
3. `Socket 'connect' timed out` in logs at boot, repeated across PM2 restart cycles → the app is correctly failing to boot rather than serving from a broken state (Must Fix #4, this volume) — look for a `{"level":"fatal",...,"event":"bootstrap.failed",...}` structured log line with the real underlying error, immediately after Nest's own `[ExceptionHandler]` diagnostic line. If that line is missing but PM2 shows repeated restarts, something regressed in `main.ts`'s `createApp()` — see "Startup failure isn't producing a `bootstrap.failed` log" below.

## Redis pressure / rate-limiting or queues behaving oddly under load

1. `redis-cli -u $REDIS_URL ping` / `wapp_infra_dependency_up{dependency="redis"}` — confirm Redis itself is reachable before assuming an application bug.
2. **Known limit, not yet fixed (TD-061):** under extreme concurrent request volume (hundreds of distinct simultaneous clients/second — see the Performance Report's stress-scenario finding), the shared Redis connection's `maxRetriesPerRequest: null` setting means a rate-limit check can queue indefinitely rather than fail fast, producing severe tail latency on otherwise-cheap endpoints. If you're seeing this: it is a known, documented, deliberately-deferred limitation at extreme concurrency, not a new incident to root-cause from scratch — check current traffic volume against the Performance Report's 400-concurrent-client stress figure before paging anyone. If real traffic is genuinely approaching that concurrency, TD-061 is the fix to prioritize (separate the throttler's Redis connection from BullMQ's, with a bounded command timeout).
3. Rate-limit headers (`X-RateLimit-Remaining`) look wrong / shared across clients that shouldn't share a bucket → check nginx's `X-Forwarded-For` is actually reaching the API (`docker/nginx/nginx.conf` already sets it) and that `main.ts`'s `app.set("trust proxy", 1)` hasn't regressed — without it, every client behind nginx collapses to one shared rate-limit bucket (a real bug this volume found and fixed; see ADR-PHD-005).

## Queue backlog / worker saturation

Use `docs/RUNBOOK-observability-operations.md`'s `wapp_queue_job_*` guidance to identify which queue. Concurrency values (set this volume, `apps/api/src/modules/*/queue/*.processor.ts`'s `@Processor(..., {concurrency: N})`):

| Queue                                                                                                                                        | Concurrency                                | Notes                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `email`                                                                                                                                      | 5                                          |                                                                                   |
| `webhook-delivery`                                                                                                                           | 5                                          |                                                                                   |
| `broadcast-execution`                                                                                                                        | 3                                          | Bounded by Meta Graph API's own rate limits, not local capacity                   |
| `data-export`                                                                                                                                | 2                                          | Retries are currently inert regardless of `attempts` — TD-059                     |
| `webhook-processing`                                                                                                                         | **1 (BullMQ default, deliberately unset)** | Do not raise without first closing the `waMessageId` check-then-act race — TD-060 |
| `retention-cleanup`, `subscription-lifecycle`, `invoice-lifecycle`, `support-session-lifecycle`, `conversation-auto-close`, `sla-escalation` | 1 each                                     | Singleton periodic sweeps — more than 1 would only contend with itself            |

- `waiting` climbing with `active` near 0 on any queue → no worker running (process crashed, or never registered). Check the API container is actually up, not just the queue's own state.
- `waiting` climbing on `webhook-processing` specifically with `active` also climbing (workers ARE running, just can't keep up) → this is a genuine capacity question, but raising its concurrency requires closing TD-060 first — do not just bump the number under incident pressure without the upsert fix in place, or duplicate inbound messages become a real, live risk under exactly the traffic spike that made you look at this in the first place.

## Startup failure isn't producing a `bootstrap.failed` log

If the API container is restart-looping and you don't see a `{"level":"fatal",...,"event":"bootstrap.failed",...}` line in its logs immediately after Nest's own `[ExceptionHandler]` diagnostic:

1. Check `main.ts`'s `NestFactory.create()` call still has `abortOnError: false` — without it, Nest's own internal teardown calls `process.exit(1)` directly from inside `ExceptionsZone`, before the error ever reaches the application's own `try`/`catch`. This is not optional or safe to remove; see ADR-PHD-006's root-cause writeup for why.
2. Check the catch block still awaits `process.stderr.write(...)`'s completion callback before calling `process.exit(1)` — a fire-and-forget `console.error()` immediately followed by `process.exit(1)` can lose the write entirely under Docker's piped, non-TTY stdout/stderr.
3. If both are intact and the log still isn't appearing, the failure may be happening even earlier — at module-import time (e.g. `ConfigModule.forRoot()`'s own env validation throwing during `app.module.ts`'s import chain, before `createApp()` is ever called at all). That failure mode is structurally different and outside Must Fix #4's own catch block's reach entirely; check for missing/invalid required env vars first (`env.validation.ts`'s full required list) before assuming a regression in the startup-failure handling itself.

## Graceful shutdown not completing cleanly

`docker stop <container>` should produce exit code 0 within the default grace period, via SIGINT → Nest's `enableShutdownHooks()`-driven sequence (Redis `quit()`, BullMQ Workers finishing any in-flight job, OpenTelemetry flush) → natural process exit. If a container is being force-killed instead (exit code 137, or Docker's "Killing" log line):

1. Check `app.enableShutdownHooks()` is still called in `bootstrap()` (`main.ts`) — without it, none of the above hooks fire at all, and the container only stops because Docker eventually force-kills it after its grace period expires.
2. Check `tracing.ts` doesn't have a second, independent `process.on("SIGTERM", ...)` handler racing Nest's own sequence — it was removed this volume in favor of `TracingShutdownService implements OnApplicationShutdown` participating in the same ordered sequence; reintroducing a standalone handler would reintroduce the race.
3. A single in-flight BullMQ job taking unusually long to finish (e.g. a large `data-export` generation) can extend shutdown up to Docker's own stop-timeout (`docker stop -t <seconds>`, default 10s) — this is expected graceful-drain behavior, not a bug, up to that timeout.
