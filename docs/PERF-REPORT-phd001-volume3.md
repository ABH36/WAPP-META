# Performance Report — PHD-001 Volume-3

**Date:** 2026-08-17
**Scope:** Baseline measurements, k6 load-test scenarios, the evidence trail behind the `API_CPU_LIMIT` default change, and known remaining limitations. Companion to `docs/ADR-PHD-005-performance-scalability-strategy.md` (application-level decisions) and `docs/ADR-PHD-006-production-infrastructure-strategy.md` (infrastructure decisions) — this document is the raw evidence those two ADRs cite, not a repeat of their reasoning.
**Test environment:** `wapp-api-test:phd001vol3` (the same image built from `docker/api.Dockerfile` and runtime-verified this volume), run standalone via `docker run` against the real local dev MongoDB (single-node replica set, `?directConnection=true`) and Redis containers, joined to the `wapp-dev_default` network. CPU/memory limits applied via `docker run --cpus`/`--memory`, empirically confirmed to apply identically to `docker-compose.prod.yml`'s `deploy.resources.limits` mechanism (see ADR-PHD-006). k6 run via the official `grafana/k6` Docker image on the same network. Scripts: `k6/scenarios/{baseline,load,stress,spike,recovery}.js`, shared helpers in `k6/lib/helpers.js`.

## Image size (Docker packaging, before/after this volume's fixes)

| Image                             | Before                                            | After     |
| --------------------------------- | ------------------------------------------------- | --------- |
| `wapp-api`                        | 679MB (unpruned equivalent)                       | **552MB** |
| `wapp-api`'s `node_modules` alone | 889MB                                             | **313MB** |
| `wapp-web`                        | n/a (never successfully built before this volume) | **358MB** |
| `wapp-admin`                      | n/a (never successfully built before this volume) | **349MB** |

## Frontend bundle baseline (new tooling, not yet acted on — see ADR-PHD-005)

| App          | Static JS (approx.) |
| ------------ | ------------------- |
| `apps/web`   | ~2.53MB             |
| `apps/admin` | ~1.79MB             |

No budget/threshold has been set against these numbers yet — `@next/bundle-analyzer` (`pnpm analyze`) is now available to investigate composition when a future volume decides to act on this.

## k6 scenario results

All five scenarios run against the API container at its **evidenced** default, `API_CPU_LIMIT=2.0` / `API_MEMORY_LIMIT=512M` (see "The CPU limit evidence trail" below for why 2.0, not the originally-shipped 1.0).

### Baseline — `/api/health`, 10 constant VUs, 2 minutes

| Metric      | Value                                            |
| ----------- | ------------------------------------------------ |
| p95 latency | 22.16ms                                          |
| p99 latency | 55.71ms                                          |
| Error rate  | 0.00%                                            |
| Thresholds  | All passed (p95<150ms, p99<300ms, error rate<1%) |

Establishes the steady-state latency floor every other scenario is compared against. `/api/health` performs zero Mongo/Redis I/O per request (a pure in-memory `readyState` check — confirmed by reading `health-check.service.ts`), so this measures raw HTTP/Express/Node overhead under the production resource limits, not database latency.

### Load — mixed realistic workload, ramping 0→50 VUs over 5 minutes

Each VU simulates one distinct tenant/client (own `X-Forwarded-For`, stable per VU — see "Why every k6 VU gets its own simulated IP" below), polling `/api/health` and calling `/api/v1/auth/register` (bcrypt hash + Mongo write + BullMQ email-queue enqueue) at most once per ~20s, comfortably inside SEC-009's 5/min per-client throttle.

| Metric                      | Value                                             |
| --------------------------- | ------------------------------------------------- |
| `/api/health` p95           | 21.34ms                                           |
| `/api/v1/auth/register` p95 | 498.17ms                                          |
| Error rate                  | 0.00%                                             |
| Thresholds                  | All passed (health p95<300ms, register p95<800ms) |

### Stress — pure `/api/health`, ramping 0→400 VUs over 8 minutes

Isolates raw container capacity from SEC-009/SEC-010's intentional rate-limit ceilings (each VU still has its own simulated client IP).

| Metric                            | Value                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Error rate                        | **21.25%**                                                                                             |
| p95 latency (successful requests) | 1.26s                                                                                                  |
| **Max observed latency**          | **43m38s**                                                                                             |
| Container outcome                 | Survived without crashing — back to 1.56% CPU / 225MB memory within minutes of the load pattern ending |

**Finding:** the severe tail latency does not match `/api/health`'s own near-zero compute cost. Root-caused to the shared Redis connection's `maxRetriesPerRequest: null` setting (correct for BullMQ, wrong for the synchronous per-request `ThrottlerGuard` check reusing the same connection) — under extreme concurrent throttle-check pressure, a command can queue indefinitely rather than failing fast, blocking whatever HTTP request is waiting behind it. Documented as **TD-061**, deliberately not fixed this volume (see ADR-PHD-005 for the full reasoning). The container itself never crashed or required a restart — a genuinely positive resiliency signal distinct from the latency finding.

### Spike — pure `/api/health`, sudden burst to 200 VUs, ~90 seconds total

| Metric                            | Value                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Error rate                        | 35.87%                                                                           |
| p95 latency (successful requests) | 534.33ms                                                                         |
| Max observed latency              | 11.18s                                                                           |
| Drain behavior                    | Fully drained within the 90s test window — no long tail like the stress scenario |

Consistent with the same Redis-contention hypothesis as stress, at a smaller scale and shorter duration — the shorter window meant contention never compounded into the multi-minute tail seen at 400 VUs sustained for 8 minutes.

### Recovery — 300-VU surge (70s) immediately followed by a 10-VU, 2-minute low-load window

| Metric                    | Value                                      |
| ------------------------- | ------------------------------------------ |
| Surge-phase error rate    | High (dominates the 56.58% overall figure) |
| **Recovery-window p95**   | **34.81ms**                                |
| Recovery-window threshold | Passed (p95<200ms)                         |

**Finding, genuinely positive:** once the 300-VU surge ends, latency in the following low-load window returns to a figure directly comparable to the clean baseline (22.16ms) almost immediately — no prolonged degradation, no lingering elevated error rate. The system recovers cleanly; the Redis-contention issue found by stress/spike does not leave a lasting mark once load actually drops.

## The `API_CPU_LIMIT` evidence trail

`docker-compose.prod.yml` shipped with `API_CPU_LIMIT` defaulting to `1.0`, explicitly documented as a conservative, unvalidated starting value pending real load-test evidence (the Architect's own resolution for this exact question). A focused diagnostic (30 concurrent, synchronized `/api/v1/auth/register` calls — a deliberately harder worst-case than `load.js`'s gradual ramp) measured:

| CPU limit              | p95 latency | avg latency |
| ---------------------- | ----------- | ----------- |
| 1.0 (original default) | 20.92s      | 11.69s      |
| 2.0                    | 6.46s       | 4.02s       |
| 4.0                    | 3.66s       | 2.42s       |

bcrypt (cost factor 12 — a legitimate OWASP-range security default, deliberately not weakened for this) is CPU-bound work; under a hard 1.0-CPU cgroup quota, Node's libuv threadpool workers computing concurrent hashes compete for a single core's worth of actual execution time, producing severe queueing under concurrent registration bursts. The 1.0→2.0 step captured the largest relative improvement (3.2×) before returns diminished sharply (2.0→4.0 only gained a further 1.8× for a full additional core). **`API_CPU_LIMIT`'s default is now `2.0`** — the evidenced stopping point, not the maximum tested value. Confirmed clean under the realistic `load.js` ramping pattern at the new default: register p95 dropped to 498.17ms, comfortably under threshold (see "Load" above) — the 1.0 CPU diagnostic's 20.92s figure represented a synchronized worst-case burst, meaningfully more aggressive than typical gradual ramp-up traffic.

## Why every k6 VU gets its own simulated client IP

A discovery made while setting up these tests, not part of the original scope: the API had no Express `trust proxy` configuration, so behind nginx in production every tenant's request would have collapsed to the same `req.ip`, making SEC-010's 300 req/60s rate limit an accidental platform-wide cap rather than a per-client one. Fixed this volume (`app.set("trust proxy", 1)`, see ADR-PHD-005) and directly relevant to how these tests are constructed: every k6 VU is assigned a distinct simulated IP via `X-Forwarded-For` (`k6/lib/helpers.js`'s `vuIp()`), stable across that VU's own iterations — modeling many distinct tenants rather than one client hammering a shared rate-limit bucket, which is what these scenarios are meant to represent. Without this, the results below would measure the rate limiter's own ceiling, not the application's or container's actual capacity.

## Known remaining limitations (not fixed this volume, tracked in `docs/TECH-DEBT.md`)

- **TD-059** — `data-export` queue retries are structurally inert (its processor swallows all errors internally, so any `attempts` value beyond 1 has no effect).
- **TD-060** — `webhook-processing`'s BullMQ concurrency is held at the default (1) pending an atomic upsert fix for a check-then-act race on `waMessageId`; no load data exists yet for this specific queue since k6 testing this volume exercised `/api/health` and `/api/v1/auth/register`, not the inbound webhook path.
- **TD-061** — the Redis-backed throttler's shared, unbounded-retry connection is the most likely root cause of the stress/spike scenarios' severe tail latency; a bounded-timeout, separate connection is the fix, deferred pending real traffic approaching the concurrency level where this was observed.

## What this report does not claim

This is a local Docker-network measurement against a single-node dev MongoDB and a single Redis instance, not a production-representative multi-region or Atlas-backed measurement — absolute numbers (especially Mongo-write-path latency) should be treated as directionally useful, not as a production SLA commitment. The stress/spike scenarios intentionally push far beyond WAPP's current expected beachhead-stage traffic to find where the system's current limits actually are; finding a limit at 400 concurrent distinct clients is not evidence of a problem at expected near-term load, only evidence of where the next capacity conversation should start.
