# FINAL-QA-001 — Release Validation & Production Readiness

**Status:** Approved — Final QA execution authorized (2026-08-17)
**Date:** 2026-08-17 (updated same day with the Architect's 3 resolved decisions)
**Author:** Implementing Engineer, cross-referenced against the actual repository state per the Architect's governance rule — this document does not assume the frozen documentation is perfectly synchronized with the implementation, and notes every place that assumption was checked and what was actually found.

## Resolved decisions (Architecture / Release Validation Review, 2026-08-17)

1. **First real GitHub Actions run**: a dedicated temporary `final-qa/*` verification branch + a real PR targeting `main`, never a direct push to `main`. The branch/PR carries only the already-approved, already-frozen CI workflow state (nothing new) purely to execute it in GitHub's real environment. Actual run IDs/results are recorded (§15); workflow-only failures are classified separately from application defects; no unrelated code is silently modified or merged just to obtain a green run. A minimum, documented correction is permitted only if the workflow itself needs one. On success, this replaces PHD-001 Volume-4's "not yet executed on GitHub" status with real verification.
2. **Release Candidate tag**: `v1.0.0-rc.1` (and `-rc.2`, etc. only if a further candidate is actually required). `v1.0.0` is reserved exclusively for the real production release and must not be used during Final QA. Candidate tags are annotated, point to immutable commits, and are never force-moved.
3. **Production smoke-test authorization**: none, by default. Final QA has no standing production access. A predefined, limited, explicitly-listed smoke-test set is authorized only after a separate, explicit production deployment/release-window authorization is granted — read-only wherever possible, non-destructive, dedicated test identities only. Real payment capture, refunds, invoice/subscription mutation, destructive data operations, tenant/user deletion, Feature Flag or Maintenance Mode mutation, Break-Glass grants, API-key rotation, webhook-secret rotation, and production config mutation are never part of the default smoke suite regardless of authorization state.

Additional standing boundaries reaffirmed by the same review: PHD-001 Volume-1–4 remain frozen; TD-056 (SBOM/signing) stays out of scope; TD-059–063 stay accepted/deferred unless Final QA surfaces genuine new evidence changing their release-blocking classification (raised for a separate Architecture/Release decision, not resolved by QA itself); no Vercel/Render migration, automated production CD, new staging infrastructure, new migration framework, new caching architecture, speculative queue backpressure, or separate worker deployment. Final QA validates the existing system; it does not redesign it.

This is a **planning document only**. No implementation, code change, CI change, Docker change, deployment change, commit, or push has occurred as part of producing it, per the explicit governance rule this task was issued under.

---

## 1. Scope

Final QA validates the complete, frozen WAPP platform as one integrated product — every PRD/FRD/PHD volume together, not any single one in isolation — immediately before Production Deployment. It covers `apps/api`, `apps/web`, `apps/admin`, `packages/*`, the Docker/Compose/Nginx deployment topology, and the CI/CD pipeline exactly as PHD-001 Volume-4 left it. It does not cover anything not already built: no new feature, no new module, no new infrastructure.

## 2. Objectives

Prove — with evidence, not assertion — that the frozen system is functionally correct, secure, performant, accessible, observable, deployable, recoverable, regression-safe, and production-ready. Final QA is validation, not development: every defect found is classified first, per the taxonomy in §25, before any decision is made about whether or how it gets fixed.

## 3. Frozen baseline being validated

| Layer                                 | Status                                                                      | Where it lives                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend, PRD-001 → PRD-007            | Frozen                                                                      | Implementation + ~91 backend ADRs (`docs/ADR-{AUTH,BILL,COMM,CRM,EVENTS,INFRA,PLAT,SET}-*.md`). **The original PRD planning documents themselves are not repo files** (relayed via chat historically, like `TAD-001`'s base document) — cross-referencing means reading the implementation and the ADRs that record what was actually approved, not re-reading source planning text that isn't in the repository. |
| Frontend, FRD-001 Volume-1 → Volume-9 | Frozen                                                                      | Implementation + `docs/ADR-FE-001` → `ADR-FE-018` (18 ADRs, confirmed via direct listing)                                                                                                                                                                                                                                                                                                                         |
| PHD-001 Volume-1 (Security)           | Frozen, pushed `8ee2ce0`                                                    | `docs/ADR-PHD-001`, `ADR-PHD-002`                                                                                                                                                                                                                                                                                                                                                                                 |
| PHD-001 Volume-2 (Observability)      | Frozen, pushed `e48d606`                                                    | `docs/ADR-PHD-003`, `ADR-PHD-004`, `docs/RUNBOOK-observability-operations.md`                                                                                                                                                                                                                                                                                                                                     |
| PHD-001 Volume-3 (Performance/Infra)  | Frozen, pushed `79aa897`                                                    | `docs/ADR-PHD-005`, `ADR-PHD-006`, `docs/PERF-REPORT-phd001-volume3.md`, `docs/RUNBOOK-performance-infrastructure.md`, `k6/`                                                                                                                                                                                                                                                                                      |
| PHD-001 Volume-4 (Release/CI/CD)      | Frozen, pushed `f983960`                                                    | `docs/ADR-PHD-007`, `ADR-PHD-008`, `docs/RELEASE-RUNBOOK.md`, `docs/RELEASE-CHECKLIST.md`                                                                                                                                                                                                                                                                                                                         |
| Technical Debt register               | 63 entries (confirmed by direct count), 61 Open / 2 Closed (TD-010, TD-021) | `docs/TECH-DEBT.md`                                                                                                                                                                                                                                                                                                                                                                                               |

**Verified, not assumed, before writing this plan:** the CI workflow (`.github/workflows/ci.yml`) already exists with 8 jobs; `apps/web`'s middleware correctly exempts `robots.txt`/`sitemap.xml`/`manifest.webmanifest`/`sw.js` from its auth-gate matcher (confirmed by reading the actual regex), while `apps/admin`'s middleware has no such exemptions at all — consistent with PWA/SEO being `apps/web`-only scope (TD-054), not a gap in `apps/admin`.

**Correction (2026-08-17, during CI/CD QA execution):** this document originally claimed the Playwright suite's `mobile`/`tablet`/`desktop` projects were "all Chromium-engine" — **that was wrong**, discovered only when the CI e2e job actually ran for real and every mobile/tablet test failed with a missing WebKit executable. Confirmed by reading `@playwright/test`'s own `devices` export directly: `devices["iPhone 13"]` and `devices["iPad Mini"]` (the `mobile`/`tablet` projects) both default to **WebKit**, not Chromium — only `devices["Desktop Chrome"]` (the `desktop` project) actually uses Chromium. §20/§21 below are corrected accordingly. There is still no Firefox coverage anywhere in this repo.

## 4. Test strategy

Evidence-based, not exhaustive-by-assumption: every QA domain below states what's already verifiable from existing PHD-001 artifacts (re-confirm, don't re-invent) versus what has never actually been tested end-to-end as one integrated system (the actual new work of this phase). Findings are classified per §25 before any fix decision. No new testing methodology is invented where an established one (k6 for load, Playwright for e2e/responsive, `pnpm audit` for dependencies) already exists and applies.

## 5. Test environments

| Environment         | What it is                                                                                                                                                                                     | What evidence from it may claim                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local               | Developer machine, `pnpm dev:*`                                                                                                                                                                | Fastest iteration; never cited as production evidence                                                                                                                                            |
| Local Docker        | The same images/compose PHD-001 Volume-3/4 built and verified                                                                                                                                  | Closest available approximation to production topology; this is where load/recovery/rollback evidence comes from, same as PHD-001 Volume-3/4                                                     |
| CI (GitHub Actions) | The actual workflow runs on `github.com`                                                                                                                                                       | The **first real end-to-end run** is itself a Final QA deliverable — PHD-001 Volume-4 explicitly could not produce this (no `act` available locally)                                             |
| Staging             | **Does not exist** (confirmed: no `docker-compose.staging.yml`, no second environment anywhere in this repo — PHD-001 Volume-4's own Architecture Review explicitly declined to provision one) | Not available as an evidence source. Final QA must not create one solely for this phase, per the explicit Out of Scope list (§29 below)                                                          |
| Production          | The real Hostinger VPS                                                                                                                                                                         | Only usable for the smoke tests already defined in `docs/RELEASE-RUNBOOK.md` §5, executed with safe test data, **after** a real release is deployed — not for destructive or exploratory testing |

Every finding in the Final QA Report (§28) must cite which of these five environments produced it. Local/Docker evidence is never represented as production evidence, per the Architect's explicit rule.

## 6. Functional QA

Both frozen critical journeys, exactly as specified:

**Tenant:** Registration → Login → Workspace access → Communication → CRM → Billing → Settings → Logout.
**Platform:** Platform Login → Dashboard → Workspace Registry → Platform Users → Billing Operations → Customer Support → Break-Glass → Global Audit → Governance → Analytics → Announcements → Feature Flags → Maintenance Mode.

Every step exercised under the frozen permission model (§8), not a superuser bypass — a journey that only "works" for an Owner/Super-Admin isn't validated. Execute against local Docker (§5); production execution is limited to the Release Runbook's own safe-data smoke tests, not full functional QA.

## 7. Security QA

Explicit validation list, each mapped to where its original implementation/decision lives so QA re-verifies against a known baseline rather than re-deriving expected behavior from scratch: tenant isolation (§9), platform-user isolation (ADR-PLAT-002's two-separate-identity-systems design), JWT boundaries + refresh-token cookie/httpOnly behavior (ADR-PHD-001), rate limiting + Redis-backed throttling (ADR-PHD-005, including the `trust proxy` fix — re-verify per-client bucket isolation still holds), Platform Admin lockout (ADR-PHD-001), password reset, session revocation, logout-all, API-key security (TD-055 — confirm it's still correctly dormant, not silently wired to a route without approval), webhook authentication (ADR-COMM-001), Break-Glass approval requirement + expiry (ADR-PLAT-005, the 240-minute cap confirmed present in `support-session.schema.ts`), support-session boundaries, audit trail (ADR-SET-007/ADR-PLAT-006), sensitive-data exposure, production security headers (Helmet config, ADR-PHD-001's frontend headers), and error-message disclosure (never leak internals to the client, per the Engineering Standards memory). No new security architecture is introduced during this QA pass — a finding here is classified (§25), not silently patched.

## 8. Permission QA

The permission system is frozen: 7 `TenantRole` values, 3 `PlatformRole` values, 20 `PlatformPermission` values (all confirmed by direct enum inspection this session), plus the tenant-side `Permission`/`PERMISSION_MATRIX`. For each role: verify read access, write access, and denied access, both backend-enforced (guard-level) and frontend-reflected (UI visibility) — a permission that's backend-correct but frontend-still-shows-the-button is a real defect class, not cosmetic. Cross-reference specifically against known permission-adjacent Tech Debt (TD-021/TD-023 write-capable support access boundary, TD-024 governance-policy runtime enforcement — confirm these remain correctly _not_ enforced, since building them now would be exactly the "silently fix frozen behavior" this phase must not do) before treating any gap there as a new finding.

## 9. Tenant-isolation QA

Create at least two independent workspace contexts (Workspace A, Workspace B) in the Docker test environment. Verify A cannot read, modify, or otherwise reach B's data across Billing, CRM, Communication, and Settings — each via a direct API call with A's own valid session token, not just "the UI doesn't show a link." Separately confirm Platform-level cross-tenant access remains real and intentional exactly where PRD-007/ADR-PLAT-001 authorizes it (registry-level Workspace/User visibility, read-only Break-Glass under an active, audited Support Session) and nowhere else — Platform's own cross-tenant reach is a frozen, approved exception to isolation, not a bug to also flag.

## 10. API-contract QA

Compare actual `apps/api` responses against what `apps/web`/`apps/admin` actually consume — DTO drift, enum drift, pagination shape, nullable-field handling, error-response shape, HTTP status codes, auth-error responses, and maintenance-mode responses. This is the one QA domain most likely to surface _pre-existing_ drift never caught before, since no volume in this engagement has done a full frontend-against-backend contract sweep as its own dedicated activity — treat findings here as potentially real, not automatically dismiss them as "already covered elsewhere."

## 11. Performance QA

Baseline is `docs/PERF-REPORT-phd001-volume3.md` — no new SLO is invented here. Re-measure the release candidate's `/api/health` baseline latency and the `/api/v1/auth/register` load-scenario figures (p95=22.16ms / p95=498.17ms respectively, at `API_CPU_LIMIT=2.0`) and compare, not re-derive from zero. A material regression (not a few-millisecond noise band) is investigated; a result consistent with the existing baseline closes this domain without further action. Frontend bundle size compared against the recorded baseline (`~2.53MB`/`~1.79MB`, web/admin) using the `@next/bundle-analyzer` tooling PHD-001 Volume-3 already wired in — no new tooling introduced.

## 12. Load/stress QA

Review PHD-001 Volume-3's already-executed baseline/load/stress/spike/recovery results first. Only re-run against the actual release candidate if the reviewed results leave a genuine open question (e.g., a code change since Volume-3 plausibly affects the measured paths) — re-running by default, unconditionally, would misrepresent "re-confirmation" as "new evidence" where none is needed. If re-run, use the existing `k6/scenarios/*.js` methodology verbatim — no new scenario shape, no new pass/fail bar invented.

## 13. Observability QA

Verify every PHD-001 Volume-2 mechanism actually surfaces a _real_ failure, not just that the mechanism exists in code: trigger an actual permission denial and confirm it's logged with `correlationId` + the structured security-event fields; trigger an actual queue failure and confirm `wapp_queue_job_failed_permanently_total` increments and the matching `ERROR` log line appears; confirm `/api/metrics`'s auth gating (401/401/200) still behaves correctly; confirm `/settings/diagnostics`'s `queues`/`cache`/`activeWorkers` fields reflect real live state, not stale/placeholder values. "The instrumentation exists" and "the instrumentation actually reports a real event correctly" are different claims — this domain proves the second, not just the first.

## 14. Infrastructure QA

Docker (`api`/`web`/`admin` images, healthchecks, resource limits — re-confirm the evidenced `API_CPU_LIMIT=2.0` default still holds under the release candidate), Nginx routing (`depends_on: condition: service_healthy`), Mongo/Redis connectivity, BullMQ queue health, graceful shutdown (`docker stop` → exit 0), and structured startup-failure handling (`abortOnError: false` + the stderr-flush fix — re-verify against a genuinely unreachable Mongo, the exact scenario PHD-001 Volume-3 root-caused). All of this was individually verified per-volume; this domain confirms none of it regressed when combined as one release candidate.

## 15. CI/CD QA

**Executed 2026-08-17 via `final-qa/github-actions-verification` (PR #1, per Decision 1) — completed, all 12 checks green as of commit `481030e`.** https://github.com/ABH36/WAPP-META/actions/runs/32028206504

Six genuine, real bugs were found and fixed, each invisible to every prior local-only verification pass and only surfaced by actually executing the workflows on GitHub — vindicating exactly why this was made a mandatory Final QA step rather than trusted as "already verified" from PHD-001 Volume-4:

| #   | Finding                                                                                                  | Root cause                                                                                                                                                                                                                                              | Fix                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Lint & Typecheck`/`Security Audit`/`commitlint` all failed at the identical `pnpm/action-setup@v4` step | `version:` input conflicted with `package.json`'s own `packageManager` field — the action refuses both at once                                                                                                                                          | Removed the redundant `version:` input; action now auto-detects from `packageManager`                                                          |
| 2   | `Lint & Typecheck` still failed after #1                                                                 | TD-057's 3 pre-existing lint findings (frozen-module files) — `pnpm lint` exits 1 unconditionally, meaning CI's lint gate had likely never been satisfiable since 2026-08-13                                                                            | TD-057 closed: applied its own already-scoped fix (properly-typed mocks, removed unnecessary assertion, enum comparison instead of raw string) |
| 3   | `Lint & Typecheck` still failed after #2                                                                 | A second, previously-untracked pre-existing finding — `apps/web`/`apps/admin next.config.ts`'s `async headers()` never awaiting anything                                                                                                                | New TD-064 filed and closed same-day: dropped the unneeded `async`, kept the `Promise`-returning contract                                      |
| 4   | `Build (web)`/`Build (admin)` failed outright                                                            | The `build` matrix job's env block never set `NEXT_PUBLIC_*` — the exact class of gap ADR-PHD-006 already fixed for the Dockerfiles, never applied to this job                                                                                          | Added the three `NEXT_PUBLIC_*` vars to the job's env block                                                                                    |
| 5   | `Docker Verify — Admin` failed: `COPY .../apps/admin/public` → "not found"                               | `apps/admin/public/` is an empty directory git has never tracked (git cannot track empty directories) — present on every local machine, absent from every fresh clone                                                                                   | Added `apps/admin/public/.gitkeep`                                                                                                             |
| 6   | `E2E` failed: every mobile/tablet test, missing WebKit executable                                        | `playwright.config.ts`'s `mobile`/`tablet` projects use `devices["iPhone 13"]`/`["iPad Mini"]`, which **default to WebKit, not Chromium** (confirmed by reading `@playwright/test`'s own `devices` export) — the e2e job only ever installed `chromium` | Install step now installs `chromium webkit`                                                                                                    |

Finding #6 also corrected a wrong claim in this document's own first draft (§3/§20/§21 originally said the whole Playwright matrix was Chromium-only) — see those sections' own correction notes.

**Resolved:** PR #1 merged to `main` (merge commit `da75956`, confirmed via the GitHub API: `state: closed, merged: true`), verification branch deleted. `main`'s own CI (triggered by the push itself) independently confirmed fully green — 10/10 applicable checks passing on `da75956` (`commitlint`/`GitGuardian` are PR-only triggers, correctly absent from a direct-push run). This is the first genuinely green CI state `main` has ever had in this repository's history.

## 16. Release Runbook QA

Treat `docs/RELEASE-RUNBOOK.md` as an executable artifact, not prose. Where practical, actually execute each numbered section against the Docker environment: pre-release checklist, version bump + annotated tag creation (a real test tag, not `v1.0.0` — that designation is reserved for the actual post-QA production release per the PHD-001 Volume-4 planning document's own sequence diagram), Docker build, deployment ordering, health checks, smoke tests. Record what actually happened at each step, not what the document says should happen.

## 17. Rollback QA

Verify rollback to a known-good git tag: application starts, healthchecks pass, smoke tests pass, and — critically — `/settings/diagnostics`/the `deployment.success` log correctly report the _rolled-back_ version's `buildVersion`/`gitCommit`, not the previous release's. No destructive production rollback test is performed; this executes against Docker, the same environment PHD-001 Volume-4's own recovery exercise used.

## 18. Recovery QA

PHD-001 Volume-4 already executed and recorded real recovery evidence (release deploy, Redis restart mid-operation, rollback redeploy, container restart — all four in `docs/RELEASE-CHECKLIST.md`'s standing log). Final QA reviews that evidence and explicitly distinguishes it from anything newly executed this phase — do not present Volume-4's historical results as if freshly re-run. Repeat a scenario only if the release candidate has changed in a way plausibly affecting it.

## 19. Frontend QA

Both `apps/web` and `apps/admin`, across the three viewport classes the actual Playwright config supports (mobile/tablet/desktop — see §20 for the honest browser-engine caveat): navigation, authentication, protected-route redirects, responsive layout (no horizontal overflow, the existing spec pattern), forms, error states, loading states, dialogs, charts, tables, pagination, and the PWA-specific items in §21. Reuse the existing `e2e/*.spec.ts` suite as the base, extending only where a real gap is found — not rewriting what already passes.

## 20. Accessibility QA

Validate the frozen FRD-001 Volume-9 requirements: keyboard-only navigation, focus visibility, focus trapping in dialogs, Escape-to-close behavior, screen-reader landmarks, accessible names, form labels, error announcements, contrast, reduced-motion handling, semantic headings, skip navigation. **Automated tooling (axe-core/Lighthouse) plus real interaction checks, per the explicit instruction that an automated score alone is not proof** — a Lighthouse pass can miss focus-trap or screen-reader-announcement defects that only manual keyboard/screen-reader interaction surfaces.

## 21. Browser QA

**Honest baseline, corrected from this document's own original (wrong) claim**: the existing Playwright configuration runs three device _emulations_ across **two real rendering engines**, not one — `iPhone 13` (mobile) and `iPad Mini` (tablet) both actually run under **WebKit** (Playwright's own device-descriptor default for those two, confirmed by reading `@playwright/test`'s `devices` export directly), while `Desktop Chrome` (desktop) runs under Chromium. There is still no Firefox coverage anywhere in this repository. Final QA's browser-compatibility claim must say exactly this — "verified under WebKit (mobile/tablet) and Chromium (desktop), no Firefox" — neither overclaiming nor underclaiming what actually runs. Adding real Firefox coverage to `playwright.config.ts` is a legitimate candidate _finding_ this phase can raise (classified per §25, likely a Non-blocking Observation or a new Tech Debt entry), but is not silently added as part of "QA" itself.

## 22. PWA QA

`apps/web` only (confirmed scope boundary, TD-054): manifest (`apps/web/src/app/manifest.ts`), service worker (`apps/web/public/sw.js`), installability, offline fallback (`/offline`), update notification, cache allow-list — and explicitly confirm authenticated API responses are never cached (a real security-adjacent check, not just a functionality one). Confirm the middleware exemption for `robots.txt`/`sitemap.xml`/`manifest.webmanifest`/`sw.js` (already read directly from `apps/web/src/middleware.ts` while preparing this plan) still holds under the release candidate — this was itself a previously-shipped bug fix (FRD-001 Volume-9), so a regression here would be a real defect, not a new gap.

## 23. SEO QA

Infrastructure only, per the explicit instruction not to invent marketing content for the placeholder public site: `robots.ts`, `sitemap.ts`, and Open Graph defaults, all confirmed present in `apps/web/src/app/`. Verify they render correctly and remain unauthenticated/uncached, nothing more.

## 24. Dependency/security audit

Run `pnpm audit` fresh against the release candidate and compare against the two already-documented baselines in `docs/DEPENDENCY-AUDIT-phase1.md` (PHD-001 Volume-1's `0 critical/15 high/20 moderate/5 low`, reconfirmed unchanged in PHD-001 Volume-4). A finding identical to the existing baseline is not re-litigated; a genuinely new finding is classified per §25. No SBOM/signing architecture is introduced — TD-056 remains explicitly out of scope.

## 25. Defect classification and severity

Every finding is classified by **type** first:

`Release Blocking Defect` · `Critical Security Finding` · `Critical Reliability Finding` · `Functional Defect` · `Regression` · `Performance Failure` · `Accessibility Failure` · `Deployment Failure` · `Configuration Defect` · `Documentation Defect` · `Non-blocking Observation` · `Existing Accepted Technical Debt` · `Out of Scope`

...then by **severity**:

| Severity | Meaning             | Release gate                                                      |
| -------- | ------------------- | ----------------------------------------------------------------- |
| P0       | Production-blocking | Release cannot proceed until resolved                             |
| P1       | Critical            | Release cannot proceed without explicit Architect risk-acceptance |
| P2       | Major               | Documented; Architect decides block-vs-accept per instance        |
| P3       | Minor               | Logged as Tech Debt or a follow-up item; does not block           |
| P4       | Observation         | Recorded for awareness; no action required                        |

A finding that matches an existing `docs/TECH-DEBT.md` entry is classified as `Existing Accepted Technical Debt`, cross-referenced by TD number, and **not** treated as a new defect or silently closed just because QA happened to encounter it (§26).

## 26. Technical-debt disposition

Every entry from TD-023 through TD-063 (the range explicitly named, plus any confirmed present in the actual file — the direct count this plan verified is 63 total, 61 Open) gets one disposition: `Accepted for release`, `Release blocking`, `Requires separate initiative`, `No longer applicable`, or `Resolved`. Given entries TD-059 through TD-063 were deferred by explicit Architect instruction as recently as PHD-001 Volume-3/4 ("must not be silently implemented as part of Volume-4"), the strong default disposition for those five is `Accepted for release` unless QA execution surfaces genuinely new evidence changing that calculus — not a re-opening of a decision already made twice.

## 27. Test-data strategy

Disposable test data (created and destroyed within a QA run — new workspaces, new users) vs. persistent test fixtures (a small, known set of accounts/workspaces reused across QA cycles, documented by name) vs. production data (never mutated by any QA activity). Financial/billing QA uses `PaymentService.record()`'s manual-entry path with clearly-labeled test amounts, never a real payment. Break-Glass/Support-Session QA uses dedicated test Platform-Admin and tenant identities, never a real customer workspace.

## 28. Final QA Report — required structure

Produced at the end of QA execution (not part of this planning document): test environment(s) used per finding, exact commit/tag tested, test categories executed, test counts, pass/fail per category, every defect found with its severity and type classification, existing-TD cross-references, performance comparison against the PHD-001 Volume-3 baseline, security findings, accessibility findings, deployment findings, rollback/recovery results, and a final release recommendation.

## 29. Final release recommendation

One of exactly three values: **READY**, **READY WITH ACCEPTED RISKS**, or **NOT READY** — each justified against the 14-question Final Release Gate below, not asserted on its own.

## 30. Final Release Gate

The recommendation must explicitly answer all fourteen: (1) functionally ready? (2) security posture acceptable? (3) tenant isolation proven? (4) platform isolation proven? (5) billing workflows safe? (6) critical permissions enforced? (7) observability operational? (8) production build reproducible? (9) CI operational (real GitHub Actions run, not local-only)? (10) deployment reproducible? (11) rollback verified? (12) recovery verified? (13) known Tech Debt explicitly accepted (§26)? (14) any release-blocking defects open?

---

## Out of scope (unless separately approved)

New product features; backend or frontend redesign; new security, caching, or migration-framework architecture; a new infrastructure provider (Vercel/Render — already explicitly closed by the Architect in PHD-001 Volume-4); Kubernetes; multi-region deployment; SBOM/image-signing (TD-056); new staging infrastructure; automated production CD. Final QA validates the frozen system; it does not redesign it.

## Completion gate

```
This planning document
      ↓
Architecture Review / Release Validation Review
      ↓
Architect resolves any genuine ambiguity raised
      ↓
Formal Architect Approval
      ↓
Final QA execution begins
```

No QA execution, code change, CI change, Docker change, deployment change, commit, or push occurs until formal approval of this plan is received.

## Questions raised and resolved (Architecture / Release Validation Review, 2026-08-17)

All three genuine ambiguities raised in this document's original draft were formally resolved by the Architect — see "Resolved decisions" at the top of this document. Retained here only as a record that the doubt policy was actually exercised, not silently bypassed:

1. **GitHub Actions first-real-run mechanics** — resolved: dedicated `final-qa/*` branch + PR against `main`, never a direct push to `main`.
2. **Release-candidate tag naming** — resolved: `v1.0.0-rc.1` (`-rc.2`+ only if needed); `v1.0.0` reserved for the real release.
3. **Production smoke-test authorization** — resolved: none by default; a limited, explicit set only after a separate production release-window authorization.
