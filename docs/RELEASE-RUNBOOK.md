# Release Runbook — Production Deployment

**Scope:** PHD-001 Volume-4 deliverable. The concrete, human-executed procedure for shipping a release to the Hostinger VPS. Design rationale lives in `docs/ADR-PHD-007-release-cicd-strategy.md`/`docs/ADR-PHD-008-production-deployment-rollback-strategy.md` — this document is "what to actually type," not "why." Use alongside `docs/RELEASE-CHECKLIST.md` (the same procedure, as tickable items) and `docs/RUNBOOK-performance-infrastructure.md`/`docs/RUNBOOK-observability-operations.md` for in-incident diagnosis once a release is live.

**Standing rule, per the approved architecture:** CI verifies; a human executes every step below. No step here is triggered automatically by a git push or merge.

## 1. Pre-release

1. Confirm CI is green on `main` for the commit you intend to release (`gh pr checks` or the Actions tab — `lint-typecheck`, `test`, `build`, `security-audit`, `e2e`, `docker-verify-api`, `docker-verify-web`, `docker-verify-admin` all passing).
2. Confirm `docs/TECH-DEBT.md` has no newly-introduced item that should block this release (most won't — Tech Debt is deliberate, accepted scope, not a release blocker by default).
3. If this release includes a schema/index change: confirm it followed Expand → Deploy → Migrate → Contract (ADR-PHD-008) — a destructive (Contract-phase) change must not ship in the same release as its own Expand phase.
4. Confirm MongoDB Atlas backup status per the Release Checklist's manual-confirmation item (this repository cannot verify Atlas console settings itself — see ADR-PHD-008).
5. Choose the release version (SemVer, Conventional-Commits-informed — `feat` since last tag → minor, `fix` only → patch, any `BREAKING CHANGE` → major):
   ```bash
   git log <last-tag>..HEAD --oneline   # review what's actually shipping
   ```
6. Bump `version` in `package.json` (root) and each of `apps/api`, `apps/web`, `apps/admin` to the chosen version, commit (`chore(release): vX.Y.Z`), push to `main` through the normal PR process (this is a normal commit — it goes through CI like any other change, it does not bypass review).
7. Tag the released commit — **annotated, never force-moved** (ADR-PHD-007, §15's "release tags must be immutable"):
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

## 2. Release Candidate verification (local, before touching production)

No staging environment exists — this step uses the same local Docker approach PHD-001 Volume-3 built and proved, immediately before deploying to the real VPS, not a separate permanent environment.

```bash
git checkout vX.Y.Z
docker build -f docker/api.Dockerfile -t wapp-api:vX.Y.Z .
docker build -f docker/web.Dockerfile -t wapp-web:vX.Y.Z . \
  --build-arg NEXT_PUBLIC_API_URL=<real prod API URL> \
  --build-arg NEXT_PUBLIC_APP_URL=<real prod web URL>
docker build -f docker/admin.Dockerfile -t wapp-admin:vX.Y.Z . \
  --build-arg NEXT_PUBLIC_API_URL=<real prod API URL> \
  --build-arg NEXT_PUBLIC_ADMIN_APP_URL=<real prod admin URL>
```

Boot each against local/dev-adjacent Mongo/Redis (matching PHD-001 Volume-3's own k6-testing setup), confirm:

- `api`: `/api/health` returns `{"status":"ok"}`, logs show `event: "deployment.success"` with the correct `buildVersion`/`gitCommit` (confirms the version-exposure wiring from ADR-PHD-007 is working for **this specific tag**, not just "unknown").
- `web`: `/` returns 200.
- `admin`: `/login` returns 200.

Do not proceed to production deployment if any of these fail — this is the whole point of a Release Candidate step existing at all.

## 3. Production deployment

On the Hostinger VPS, as the deploy operator:

```bash
cd /path/to/wapp
git fetch --tags
git checkout vX.Y.Z

export BUILD_VERSION=$(git describe --tags --exact-match)
export GIT_COMMIT=$(git rev-parse HEAD)

# Ordering per ADR-PHD-008 — depends_on: condition: service_healthy already
# encodes most of this structurally; explicit here for a partial redeploy.
docker compose -f docker-compose.prod.yml up -d --build redis
docker compose -f docker-compose.prod.yml up -d --build api
docker compose -f docker-compose.prod.yml up -d --build web
docker compose -f docker-compose.prod.yml up -d --build admin
docker compose -f docker-compose.prod.yml up -d --build nginx
```

If this release includes a Migrate-phase backfill script (ADR-PHD-008), run it **after** `api` is healthy but this is a manual, per-release step — there is no automated migration runner to invoke.

## 4. Health verification

```bash
curl -sf https://<domain>/api/health | grep -q '"status":"ok"'
curl -sf https://<domain>/ >/dev/null            # web
curl -sf https://<domain>/login >/dev/null        # admin (or the admin subdomain's own /login)
docker compose -f docker-compose.prod.yml ps      # every service "healthy"
```

Check the API's own boot log for the `event: "deployment.success"` line and confirm `buildVersion`/`gitCommit` match the tag you just deployed — this is the concrete, observable proof the right artifact is actually running, not just that _something_ is running (§14/BR-002).

## 5. Smoke tests

Minimal real-workflow checks against production, using safe test data — **never** real customer data, and nothing that triggers an irreversible financial/administrative action (§23):

- **Identity**: login with a known non-production test account → refresh → logout. Confirm the refresh cookie is set/cleared correctly (same behavior PHD-001 Volume-1 verified originally).
- **Workspace**: the test account can load its workspace.
- **Communication**: conversation list loads for the test workspace.
- **CRM**: lead list loads.
- **Billing**: subscription/plan info loads (read-only — do not record a payment or trigger a plan change as a smoke test).
- **Settings**: settings page loads.
- **Platform**: a Platform Administrator test account can authenticate and load the workspace registry (read-only).

## 6. Deployment observability verification

Per ADR-PHD-007's §35 implementation — confirm the deployment is visible through the existing PHD-001 Volume-2 stack, not just via manual curl checks above:

- `wapp_infra_dependency_up{dependency="mongodb"}` and `{dependency="redis"}` both `1` (`/api/metrics`, bearer-token authenticated).
- Recent logs contain the `deployment.success` structured line with this release's `buildVersion`/`gitCommit`.
- No spike in `wapp_queue_job_failed_permanently_total` or error-rate metrics in the minutes immediately following deploy.

## 7. Rollback procedure

If health verification, smoke tests, or the minutes immediately following deploy reveal a critical failure (§27 — do not continue rollout past a failed critical health check):

```bash
git checkout <previous known-good tag>
export BUILD_VERSION=$(git describe --tags --exact-match)
export GIT_COMMIT=$(git rev-parse HEAD)
docker compose -f docker-compose.prod.yml up -d --build
```

Then repeat Sections 4-6 (health verification, smoke tests, observability check) against the rolled-back version. **Do not** attempt to reverse a database migration as part of rollback (ADR-PHD-008, BR-006) — if the failed release included a destructive schema change, that requires its own separately-reviewed recovery, not an automatic reversal.

## 8. Emergency change procedure

For a critical production incident requiring an immediate patch outside the normal release cadence:

1. Identify severity — does this genuinely require bypassing the normal multi-step release cadence, or can it wait for the next scheduled release?
2. Write the minimal patch — smallest change that resolves the incident, not a bundled opportunity to ship other pending work.
3. The patch still goes through a PR and CI (§34 — "must never become a normal bypass around CI") — an emergency changes the _urgency_, not whether CI runs.
4. Deploy following Sections 3-6 above, unchanged.
5. Document the incident and the emergency patch afterward — what happened, why it was emergency-classified, what the patch did, and (if applicable) what the corresponding non-emergency follow-up fix will be.

## 9. Recovery exercise (performed, not just documented)

§38 requires an actual controlled recovery exercise, not documentation asserting readiness. The exercise performed for this volume — container restart and redeploy-of-previous-artifact, against the same local Docker infrastructure PHD-001 Volume-3 built — is recorded with its real results in `docs/RELEASE-CHECKLIST.md`'s verification log, not narrated here as a hypothetical.
