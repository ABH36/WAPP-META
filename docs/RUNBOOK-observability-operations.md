# Operational Runbook — Observability, Monitoring & Logging

**Scope:** PHD-001 Volume-2 deliverable (§4.14). Practical, "when X happens, do Y" procedures for operating `apps/api`'s observability surface — not a design explanation (see ADR-PHD-003/ADR-PHD-004 for the "why").

## Endpoints at a glance

| Endpoint                        | Auth                                         | Purpose                                                                                                                                                                                                                               |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`               | None (public)                                | Database-only liveness/readiness, for container/orchestrator probes. `200` + `status:"ok"` when the Mongo connection is up, `200` + `status:"degraded"` otherwise (never a non-200 — probes read the JSON body, not the status code). |
| `GET /api/metrics`              | `Authorization: Bearer <METRICS_AUTH_TOKEN>` | Prometheus text-exposition format. Every named business/infra/queue/security metric on one registry.                                                                                                                                  |
| `GET /api/settings/diagnostics` | JWT (workspace member)                       | Human-facing dashboard: platform checks + workspace-specific WhatsApp status + build/environment metadata + feature flags + per-queue status + cache status.                                                                          |

## Investigating a reported incident: correlation-ID walk

Every request/job carries an `X-Correlation-ID` (generated if the caller didn't send one, echoed back in the response header either way). Every log line for that request or job — not just the pino-http access-log line, every `Logger.log()` call anywhere in the service layer — carries the same `correlationId` field.

1. Get the correlation ID. From a user report: ask for the `X-Correlation-ID` response header (browser devtools → Network tab → the failing request → Response Headers) or the `x-request-id`/`x-correlation-id` shown in any error toast that surfaces it. From a log line you're already looking at: it's the `correlationId` field.
2. Grep the aggregated log stream for that exact value. Every log line touched by that request/job — across every service method it called into, every queue job it enqueued (if the job inherited the same ID via `withCorrelationId()`) — will have it.
3. If distributed tracing is configured (`OTEL_EXPORTER_OTLP_ENDPOINT` set), the same log lines also carry `trace_id`/`span_id` — pull up the full trace in whatever OTLP-compatible backend is receiving spans (this volume ships the provider-neutral emitter only; no backend is deployed as part of it) to see the full request timeline, including any BullMQ job spans (`queue.<name>`) it triggered.
4. If the correlation ID crosses into a BullMQ job (an enqueue happened during the request), the job's own `queue.<name>` span and every log line inside that job's `handle()` will carry the _same_ correlation ID as the originating request — the two are the same investigation, not two separate ones.

**Caveat:** a self-triggered sweep job (retention cleanup, subscription/invoice/support-session expiry sweeps — anything with no originating HTTP request) generates its own fresh correlation ID on every tick. Don't expect to find a "parent" HTTP request for those; there isn't one by design.

## Reading `/metrics`

```
curl -H "Authorization: Bearer $METRICS_AUTH_TOKEN" https://<api-host>/api/metrics
```

- `401` with no body detail beyond "Missing bearer token" / "Invalid bearer token" → the token is wrong, missing, or the scraper isn't sending the header at all. Check the scraper config's `Authorization` header, and that `METRICS_AUTH_TOKEN` in the scraper's config matches the value actually set in the running API's environment (not a stale copy).
- Every metric name is prefixed `wapp_`. Business-domain counters (`wapp_auth_*`, `wapp_billing_*`, etc.) are all `_total` counters — rate them (`rate(wapp_billing_payments_total[5m])`) rather than reading the raw cumulative value.
- No metric is ever labeled by `workspaceId` — if you need per-workspace detail, that's a logs/audit-log query, not a metrics query (see ADR-PHD-004's cardinality-discipline rationale).

## Queue health: reading `wapp_queue_job_*` and `/settings/diagnostics`'s `queues` field

- `wapp_queue_job_failed_permanently_total{queue="<name>"}` climbing → jobs on that queue are exhausting all configured retry attempts. The corresponding `ERROR`-level log line (`Job <id> on queue <name> permanently failed after N attempt(s): <message>`) has the actual failure reason — search for it by queue name, not by correlation ID, since a permanently-failed job's own correlation ID may not be known to whoever's investigating yet.
- `wapp_queue_job_retries_total{queue="<name>"}` climbing without a matching rise in `_failed_permanently_total` → transient failures that are recovering on retry (external API flakiness, a brief Redis blip, etc.) — worth watching, not necessarily worth paging on.
- `/settings/diagnostics`'s `queues` array (`{name, waiting, active, completed, failed, delayed, workers}`) gives a live snapshot per queue. `waiting` climbing steadily with `active` staying near 0 → no worker is picking up jobs on that queue (check `workers` — 0 means the process hosting that queue's `@Processor()` isn't running, or crashed). `activeWorkers` at the top level of the Diagnostics response is the sum across every queue.

## Infra dependency down: `wapp_infra_dependency_up`

`wapp_infra_dependency_up{dependency="mongodb"}` / `{dependency="redis"}` — `1` means the last check succeeded, `0` means it failed. This gauge updates on every call to `HealthCheckService.checkDatabase()`/`checkRedis()` (i.e., every `/health` hit updates the MongoDB gauge; every `/settings/diagnostics` hit updates both).

- `mongodb` at `0` → `/health` will also be reporting `degraded`. Check the API process's Mongo connection string/network path first; Mongoose's `readyState` is what's actually being read, so a `0` here means the driver itself has lost the connection, not just a slow query.
- `redis` at `0` → BullMQ queues (all of them share one Redis instance) and rate-limiting will be degraded or fully down. Check the Redis container/instance directly (`redis-cli ping`) before assuming an application-level bug.

## Rotating `METRICS_AUTH_TOKEN`

1. Generate a new random value (same class of secret as the JWT signing secrets — long, random, never derived from anything guessable).
2. Update the API's environment (`METRICS_AUTH_TOKEN=<new value>`) and restart the API process — this is a boot-time-read config value (`env.validation.ts` requires it non-empty at startup), not hot-reloadable.
3. Update every scraper's configured bearer token to match, before or immediately after the restart — there's no dual-token grace period, so a scraper with the old token will get `401`s from the moment the API restarts until its own config is updated.

## Cache status: `/settings/diagnostics`'s `cache` field

`{connected: boolean, usedMemoryBytes: number | null}` — parsed from Redis's own `INFO memory` output (`used_memory`). `connected: false` means the same underlying Redis reachability problem as `wapp_infra_dependency_up{dependency="redis"} == 0` above; `usedMemoryBytes` climbing steadily over time with no corresponding drop (Redis normally evicts/expires BullMQ job data once completed, per each queue's own retention config) is worth a closer look at whether a queue's completed/failed job retention is set too generously for the actual job volume.
