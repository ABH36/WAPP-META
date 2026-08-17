# Release Checklist

**Scope:** PHD-001 Volume-4 deliverable. A reusable checklist for every production release — copy Section A into a release-tracking issue/PR description per release (the `- [ ]` markdown checkbox format is both human-readable and machine-parseable, e.g. via `grep -c '\[x\]'` for a quick completion count, without a bespoke tool). Section B is a standing log of actually-performed verification exercises, not a per-release template — append to it, don't reset it.

Procedural detail for any item below lives in `docs/RELEASE-RUNBOOK.md`.

---

## Section A — Per-release checklist

**Release:** `vX.Y.Z` **Date:** \_\_\_\_ **Operator:** \_\_\_\_

### Pre-release

- [ ] CI green on the release commit — `lint-typecheck`, `test`, `build`, `security-audit`, `e2e`, `docker-verify-api`, `docker-verify-web`, `docker-verify-admin`
- [ ] Typecheck green (all packages)
- [ ] Lint green (no new regressions — pre-existing findings, if any, explicitly distinguished, not silently ignored)
- [ ] Production builds green (api/web/admin)
- [ ] Docker images build and pass their CI healthcheck verification
- [ ] Security/dependency audit executed — no new critical finding (existing high/moderate/low findings reviewed in `docs/DEPENDENCY-AUDIT-phase1.md`, not re-litigated per release)
- [ ] Database migration reviewed, if this release includes one — Expand/Deploy/Migrate/Contract phase identified (`docs/ADR-PHD-008...md`)
- [ ] **MongoDB Atlas backup status confirmed manually** (Architect/Product Owner, in the Atlas console — this repository cannot verify this programmatically): backup exists, last completed successfully, retention window known, a restore has been tested at least once
- [ ] Environment configuration verified (`.env` on the VPS matches `apps/api/.env.example`'s required-variable list — no missing required var, no stale value)
- [ ] Release artifact identified — release commit SHA and tag name recorded below

**Release commit:** `___________` **Tag:** `vX.Y.Z`

### Deployment

- [ ] Infrastructure healthy (VPS reachable, disk/memory headroom checked)
- [ ] MongoDB Atlas healthy (reachable, `wapp_infra_dependency_up{dependency="mongodb"}` = 1)
- [ ] Redis healthy (`wapp_infra_dependency_up{dependency="redis"}` = 1)
- [ ] Queues healthy (`/settings/diagnostics`'s `queues` field — no queue stuck with `waiting` climbing and `active`/`workers` at 0)
- [ ] Pending index/migration work applied, if any, and recorded here: \_\_\_\_
- [ ] API deployed — includes all BullMQ workers (single-process topology, ADR-PHD-008)
- [ ] Web deployed
- [ ] Admin deployed
- [ ] Nginx deployed/healthy

### Post-deployment

- [ ] Health checks pass (`/api/health`, web `/`, admin `/login`)
- [ ] `deployment.success` log line observed with **this release's** `buildVersion`/`gitCommit` (not a stale/previous value, not `"unknown"`)
- [ ] Smoke tests pass — Identity (login/refresh/logout), Workspace, Communication, CRM, Billing (read-only), Settings, Platform
- [ ] Error rate normal (no spike immediately following deploy)
- [ ] Logs normal (no unexpected `ERROR`/`FATAL` volume)
- [ ] Metrics normal (`/api/metrics`, no anomalous `wapp_queue_job_failed_permanently_total` jump)
- [ ] Queue depth normal
- [ ] Authentication verified end-to-end (smoke test above)

**Release outcome:** ☐ Complete ☐ Rolled back (if rolled back, note reason and previous tag restored to: `___________`)

---

## Section B — Verification exercises actually performed (standing log, not a template)

### 2026-08-17 — Controlled recovery exercise (PHD-001 Volume-4, §38)

Recorded here as an actually-performed exercise, not a documentation-only claim of readiness — see ADR-PHD-008's own explicit reasoning for why §38 requires this distinction. Performed against a real `docker/api.Dockerfile` build (`wapp-api-test:phd001vol4`), the same local Docker infrastructure PHD-001 Volume-3 built, connected to the real dev MongoDB/Redis containers.

1. **Deploy a release** — booted with `BUILD_VERSION=v3.0.0`, `GIT_COMMIT=79aa897...` (this repo's actual PHD-001 Volume-3 commit). Result: healthy within seconds; `deployment.success` log line correctly carried `buildVersion: "v3.0.0"`, `gitCommit: "79aa8971d9e894bca39226453efec2b96864d081"` — confirms the version-exposure wiring (ADR-PHD-007 §14) works end-to-end against a real container, not just in code review.
2. **Restart Redis mid-operation** (`docker restart` on the Redis container while the API kept serving traffic) — result: two expected `ECONNREFUSED` reconnect-attempt log lines from ioredis's own automatic reconnection logic, but **the API never went down** — every `/api/health` request throughout continued returning 200 with correctly-decrementing rate-limit headers, both before and after the restart. No manual intervention or API restart was needed for recovery.
3. **Redeploy a previous artifact (rollback simulation)** — `docker stop` the v3.0.0 container (confirmed clean exit code `0`, graceful shutdown still working), then deployed `BUILD_VERSION=v2.0.0`, `GIT_COMMIT=e48d606...` (the actual previous commit, PHD-001 Volume-2). Result: healthy within seconds; `deployment.success` correctly reflected `v2.0.0`/`e48d606eaf8dce6bb6fbca907112609b8ed7d2a3` — confirms the Release Runbook's rollback procedure (§7) is genuinely observable end-to-end: after a rollback, the running container's own logs prove which artifact is actually live, not just that _something_ restarted.
4. **Plain container restart** (`docker restart` on the API container itself, simulating an operational restart unrelated to a release) — result: clean recovery, `/api/health` returned 200 again within seconds, and the `deployment.success` log on restart still correctly showed `v2.0.0`/`e48d606...` (env vars persist across a restart of the same container, matching what a real `docker compose restart` does).

**Outcome:** all four scenarios recovered cleanly with no manual intervention beyond the documented commands. No gap found between documented and actual behavior.

### 2026-08-17 — Final QA / Release Candidate validation (FINAL-QA-001)

Full results in `docs/FINAL-QA-001-report.md`. Summary: `v1.0.0-rc.1` (commit `e00f7fa`) built/deployed/live-tested — found and fixed a real defect (TD-065, `/api/metrics` returning JSON instead of raw Prometheus text). `v1.0.0-rc.2` (commit `b651eae`) cut to carry the fix, confirmed fully green on GitHub Actions (10/10 checks) and re-validated live: health checks, `deployment.success` version/commit accuracy, functional tenant journey (register→login→workspace→CRM), live cross-tenant isolation (real 404 on cross-tenant access attempt), platform/tenant JWT separation (401 on tenant token against platform routes), and a full rollback (`rc.2`→`rc.1`, confirmed the _old_ bug was genuinely restored, not just relabeled) → roll-forward (`rc.1`→`rc.2`, confirmed the fix again) cycle, both with clean `exit 0` shutdowns. **Final recommendation: READY WITH ACCEPTED RISKS** — no P0 defects found; accepted risks are coverage-scope honesty notes (full permission matrix and Platform functional journey not freshly live-tested), not open defects. See the report for the complete Tech Debt disposition (all 65 entries reviewed) and the 14-question Final Release Gate.

Also the first-ever real GitHub Actions execution of PHD-001 Volume-4's CI workflows (separate from RC validation itself) — found and fixed 6 further genuine CI/lint bugs (`pnpm/action-setup` version conflict, TD-057, TD-064, missing `NEXT_PUBLIC_*` in the `build` job, untracked `apps/admin/public/`, missing WebKit browser install), merged to `main` (`da75956`), confirmed green there independently too.
