# Final QA Report — FINAL-QA-001 Release Validation & Production Readiness

**Date:** 2026-08-17
**Candidate tested:** `v1.0.0-rc.2`, commit `b651eae456a23f1b14c2b2dbed76d0d1351e3de8`
**Prior candidate:** `v1.0.0-rc.1`, commit `e00f7fad8d38a9d5fda5a00d920a7141afbf7084` (superseded — a genuine defect found during its own live validation, TD-065, required a second candidate; `rc.1`'s tag remains immutable and untouched)
**Plan this report validates against:** `docs/FINAL-QA-001-release-validation-planning.md`

## Test environments used

| Environment                                                      | Used for                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions (`ubuntu-latest`, real cloud runners)             | CI/CD QA — the first true end-to-end run of every PHD-001 Volume-4 workflow job                                      |
| Local Docker (this machine, Linux containers via Docker Desktop) | RC image builds, functional/security/tenant-isolation/observability live testing, rollback/recovery                  |
| Local (Windows host, native `pnpm`/`node`)                       | Unit tests, typecheck, lint, dependency audit                                                                        |
| Staging                                                          | Does not exist (confirmed absent, per the plan's own §5 — not created for this exercise)                             |
| Production                                                       | Not touched. No smoke test was run against production — no release-window authorization was granted (§8 of the plan) |

No finding in this report is production evidence. Every result below is local/Docker or real-but-non-production GitHub Actions evidence, labeled accordingly.

## Summary of defects found and their disposition

Nine genuine, real defects were found this exercise — five workflow-configuration bugs, two pre-existing lint findings elevated from "known" to "actually blocking," and two application-code defects (one previously undiscovered, one newly introduced by this exercise's own fix and caught before it shipped). All nine were fixed; none remain open.

| #   | Finding                                                                          | Type (§25)                                  | Severity | Where                                     | Status                  |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------- | -------- | ----------------------------------------- | ----------------------- |
| 1   | `pnpm/action-setup@v4` version conflict                                          | Configuration Defect                        | P2       | `.github/workflows/{ci,commitlint}.yml`   | Fixed, merged to `main` |
| 2   | TD-057 — 3 pre-existing lint findings blocking CI's lint gate                    | Existing Accepted Technical Debt → closed   | P2       | `apps/api` (3 files, frozen modules)      | Fixed, merged to `main` |
| 3   | TD-064 — 2 more pre-existing lint findings (`next.config.ts` × 2), never tracked | Documentation Defect + Configuration Defect | P2       | `apps/web`/`apps/admin`                   | Fixed, merged to `main` |
| 4   | Missing `NEXT_PUBLIC_*` in the CI `build` job                                    | Configuration Defect                        | P2       | `.github/workflows/ci.yml`                | Fixed, merged to `main` |
| 5   | `apps/admin/public/` never git-tracked (empty dir)                               | Configuration Defect                        | P2       | repo tracking gap                         | Fixed, merged to `main` |
| 6   | E2E job only installed Chromium; `mobile`/`tablet` need WebKit                   | Configuration Defect                        | P2       | `.github/workflows/ci.yml`                | Fixed, merged to `main` |
| 7   | **TD-065 — `/api/metrics` returned JSON, not raw Prometheus text**               | **Functional Defect**                       | **P1**   | `apps/api` (frozen PHD-001 Volume-2 code) | Fixed, on `v1.0.0-rc.2` |

Finding #7 is classified P1, not P2 like the CI-only findings — it is a real, previously-undiscovered defect in a **production-facing monitoring surface**, not test/CI infrastructure. A real Prometheus deployment scraping this API in production would have received unparseable output indefinitely. See TD-065 in `docs/TECH-DEBT.md` for the full root-cause writeup.

**No release-blocking (P0) defects were found.** No tenant-isolation bypass, no authentication/authorization bypass, no billing-correctness defect, no unrecoverable-deployment scenario, and no data-loss scenario were found in anything actually tested (see the honest coverage-depth notes in each domain below for what "tested" means per domain).

## Domain-by-domain results

### Functional QA (live-tested)

Full tenant journey executed against `v1.0.0-rc.2`'s live container: register → (email verification token confirmed correctly generated/hashed in storage, hashed value not reversible by design — see below) → login → workspace creation → CRM customer creation → list/read. All steps succeeded with correct data shapes and status codes. Email verification's HTTP round-trip specifically was **not** exercised end-to-end — this test environment has no real email delivery configured (`RESEND_API_KEY` is a placeholder), so `isEmailVerified` was set directly via the test database for two fixture accounts rather than via the real token-based flow. This is disclosed, not hidden: the verification-token _generation and hashing_ was confirmed correct (a real `EMAIL_VERIFICATION`-type token was created, matching Must Fix #1's tokenHash indexing from PHD-001 Volume-3), but the _consumption_ endpoint (`POST /api/v1/auth/verify-email`) itself was not called this session.

Platform journey: **not exercised live this session** (no Platform Administrator test account was created — doing so meaningfully would require either seeding one directly or building a Platform-specific registration flow, and time was allocated to the higher-value tenant-isolation and observability findings instead). Platform/tenant boundary enforcement _was_ tested (see Security QA below) using the existing tenant account against Platform routes.

### Security QA / Permission QA / Tenant-Isolation QA (live-tested, positive results)

Two independent tenant workspaces created (Workspace Alpha, Workspace Bravo) with distinct owners. Confirmed live, via real HTTP calls with real JWTs (not code review alone):

- Workspace A cannot read Workspace B's CRM customer by direct ID guess — real cross-tenant attempt returned `404 Customer not found` (not a generic 403 — correctly avoids confirming the resource's existence to an unauthorized tenant).
- Both workspaces' Billing subscriptions, CRM lead/customer lists, and Settings overviews are independently and correctly scoped — no cross-contamination in any list or record.
- A tenant access token is **fully rejected** (401 "Invalid or expired access token") by Platform-scoped routes — not merely permission-denied, confirming ADR-PLAT-002's "two fully separate identity/auth/guard systems" holds at the JWT-verification level, not just an application-level permission check.
- Unauthenticated requests correctly return 401; malformed/garbage bearer tokens correctly return 401 (not a 500 crash).

**Not exercised live this session:** the full tenant permission matrix across all 7 `TenantRole` values (only `OWNER` was tested, since both test accounts were workspace creators). TD-041 (Administrator's `VIEW_ONLY` billing permission not enforced server-side for subscription mutations — a real, previously-known gap, not newly discovered) was reviewed via code but not re-exploited live this session; it remains open, unchanged, and is flagged below as the one Tech Debt item worth the Architect's explicit attention rather than routine "accepted" disposition. Break-Glass, Support Session, and API-key flows were reviewed via their existing test suites (all passing in the 729/729 regression) but not freshly live-tested this session.

### API-Contract QA

Spot-checked live: `CreateCustomerDto`'s actual validation error messages, response envelope shape (`{success, message, data, meta?, errors}`), and pagination metadata (`{page, pageSize, totalRecords, totalPages, hasNext, hasPrevious}`) all matched what the frontend types expect, confirmed by cross-referencing `@wapp/shared-types` during testing. No DTO/enum drift was found in the endpoints actually exercised. **Not exhaustively re-verified**: the full API surface (hundreds of routes) was not walked field-by-field this session — this relies on the existing 729-test unit/integration suite and the `platform-analytics-governance.e2e-spec.ts` (22/22) real backend e2e suite, both passing, as the primary evidence for the rest of the surface. TD-030 (known `@wapp/shared-types` Communication enum drift) remains open and unchanged, already documented.

### Performance QA (cross-referenced, not re-run)

`docs/PERF-REPORT-phd001-volume3.md`'s baseline stands: `/api/health` p95=22.16ms, `/api/v1/auth/register` load-scenario p95=498.17ms at `API_CPU_LIMIT=2.0`. No code change in this Final QA pass touches a request-handling hot path in a way that would plausibly regress these figures (the fixes were: CI-only configuration, a metrics-endpoint response-serialization change affecting only `/api/metrics` itself, and closed lint findings in test/config files). **Not re-run**: a full k6 baseline/load/stress/spike/recovery pass against `v1.0.0-rc.2` specifically was not repeated, per the plan's own §12 guidance ("only re-run if the reviewed results leave a genuine open question") — none does here.

### Observability QA (live-tested — this is where TD-065 was found)

`/api/health`, `/api/metrics` auth gating (401/200), and `/settings` all confirmed correct over live HTTP. **TD-065 found and fixed here** (see above) — this is the one domain where live body-content verification (not just status-code checking) directly caught a real defect that two prior PHD-001 Volume-2 verification passes and an existing unit test all missed.

### Infrastructure QA (live-tested)

All three Docker images (api/web/admin) built clean from the tagged commit; all three booted healthy; graceful shutdown confirmed exit code 0 on both the rollback and roll-forward cycle (see below); `deployment.success` structured logs confirmed correct `buildVersion`/`gitCommit` at every boot. Mongo/Redis connectivity confirmed live throughout.

### CI/CD QA (live-tested — the largest single body of work this exercise)

Covered exhaustively above and in `FINAL-QA-001`'s own §15 — the first genuinely green GitHub Actions run in this repository's history, `main` at `da75956` then `b651eae`, both fully verified.

### Frontend / Accessibility / Browser / PWA / SEO QA (cross-referenced from CI's own e2e run, not freshly re-executed this session)

The Playwright suite (21/21) ran as part of CI/CD QA above, now correctly exercising **both** rendering engines actually in use (WebKit for `mobile`/`tablet`, Chromium for `desktop` — corrected from this document's own original wrong claim, see §3/§20/§21 of the plan). This suite covers: responsive layout (no horizontal overflow) on Home/Login/Forgot-Password/Offline-fallback/Platform-Administration-login pages, protected-route redirect behavior, and PWA offline-fallback rendering. **Not freshly re-tested this session**: manual screen-reader interaction, keyboard-only navigation walkthroughs, and Firefox coverage (still absent — a real, standing gap, not resolved by this exercise) were not performed live. TD-051 (a narrow, already-documented WCAG AA contrast shortfall on 2 Badge variants in dark mode) remains open and unchanged.

### Dependency/Security Audit QA (live-tested)

`pnpm audit --audit-level=critical` re-run against the current `v1.0.0-rc.2` tree: **0 critical, 15 high, 20 moderate, 5 low — identical to every prior audit this engagement**, confirming no drift. `docs/DEPENDENCY-AUDIT-phase1.md`'s existing individual-finding review stands unchanged.

## Rollback and recovery validation (live-tested)

Executed against the real `v1.0.0-rc.1` ↔ `v1.0.0-rc.2` pair, not a synthetic scenario:

1. `v1.0.0-rc.2` running → `docker stop` → clean exit code `0`.
2. Redeployed `v1.0.0-rc.1` (the genuinely older, unfixed image) → healthy, `deployment.success` correctly showed `rc.1`'s version/commit, and — as expected proof this was a real rollback, not a relabeling — `/api/metrics` correctly still showed the **old, unfixed** JSON-wrapped bug.
3. `docker stop` on `rc.1` → clean exit code `0`.
4. Redeployed `v1.0.0-rc.2` (the fixed image) → healthy, `/api/metrics` correctly showed the fix again.

One transparency note: step 4's `deployment.success` log line incorrectly showed a stale `v1.0.0-rc.1` label due to a test-harness oversight (an env file not updated between steps) — the underlying code fix was still genuinely running and verified via the metrics-body check, only that one log line's cosmetic label was wrong, and only in my own test setup, not the application.

## Tech Debt disposition (TD-023 through TD-065)

All 65 entries in `docs/TECH-DEBT.md` were reviewed in full this session (not from titles alone). Disposition legend: **A** = Accepted for release, **R** = Requires separate initiative (same as A in practice, distinguished only where a concrete future trigger is named), **N/A** = No longer applicable, **Resolved** = closed this session.

| Range                  | Disposition    | Basis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-023, TD-024         | A              | Explicit, repeated Architect deferrals (PRD-007 Volume-3/4 and PHD-001 Volume-4 all independently reaffirmed) — legal/compliance-gated or requires its own frozen-module-touching initiative                                                                                                                                                                                                                                                                                                                                             |
| TD-025 – TD-040        | A              | All FRD-001-era "named in the planning doc, no backend capability exists" gaps — each explicitly reviewed and accepted by the Architect at the time, none are correctness/security defects                                                                                                                                                                                                                                                                                                                                               |
| **TD-041**             | **A, flagged** | Administrator's `VIEW_ONLY` billing permission is not enforced server-side for subscription mutations — frontend correctly hides the action, but a direct API call from a `VIEW_ONLY` Administrator would still succeed. This is the one item in this range with a live security implication rather than a missing-feature gap. Not re-exploited live this session; **recommend the Architect explicitly confirm accepted-risk status for this specific release** rather than let it pass by the same routine disposition as the others. |
| TD-042 – TD-050        | A              | Same shape as TD-025–040 — named-but-unbuilt features, explicitly scoped out at the time                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| TD-051                 | A              | Narrow (3–4%) WCAG AA contrast shortfall, 2 Badge variants, dark mode only, never the sole signal (always paired with a text label)                                                                                                                                                                                                                                                                                                                                                                                                      |
| TD-052 – TD-054        | A              | Explicit scope boundaries (placeholder public site, known frontend perf ceiling, PWA scope)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| TD-055, TD-056         | A              | Dormant-but-secure code (TD-055) and SBOM/signing (TD-056) — both explicitly reaffirmed out of scope again this session (PHD-001 Volume-4's own approval)                                                                                                                                                                                                                                                                                                                                                                                |
| TD-057                 | **Resolved**   | Closed this session (CI/CD QA)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| TD-058                 | A              | Non-blocking observability gap (a metric not incremented at one lifecycle point), unrelated to this release's correctness                                                                                                                                                                                                                                                                                                                                                                                                                |
| TD-059, TD-060, TD-063 | A              | Explicitly reaffirmed deferred/accepted twice already (PHD-001 Volume-3, then Volume-4's approval); no new evidence this session changes that                                                                                                                                                                                                                                                                                                                                                                                            |
| TD-061, TD-062         | A              | Same — explicitly reaffirmed, only manifests at concurrency/scale far beyond current beachhead-stage traffic                                                                                                                                                                                                                                                                                                                                                                                                                             |
| TD-064                 | **Resolved**   | Closed this session (CI/CD QA)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **TD-065**             | **Resolved**   | Closed this session (Observability QA) — see above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

No TD entry was closed "merely because QA encountered it" without independent evidence — TD-057/064/065 were closed because each directly, demonstrably blocked either the CI gate itself (057/064) or a production-facing monitoring surface (065), each with its own root-cause writeup and verification, not a blanket sweep.

## Final Release Gate — the 14 required questions

1. **Functionally ready?** Yes, for the journeys actually tested (tenant registration→workspace→CRM, cross-tenant isolation). Platform journey and the full 7-role permission matrix were not freshly live-tested this session (see honesty notes above) — recommend as a follow-up before the actual production cutover, not a blocker for candidate status.
2. **Security posture acceptable?** Yes, with TD-041 flagged for explicit Architect risk-acceptance (above) rather than silent pass-through.
3. **Tenant isolation proven?** Yes — live-tested, real cross-tenant access attempt correctly denied.
4. **Platform isolation proven?** Yes — live-tested, tenant token fully rejected by platform routes at the JWT-verification level.
5. **Billing workflows safe?** Subscription read/scoping confirmed correct; no payment/refund mutation was tested (correctly excluded — no production-adjacent financial mutation belongs in a routine QA pass).
6. **Critical permissions enforced?** Yes, for what was tested; TD-041 is the one known, pre-existing exception, not new.
7. **Observability operational?** Yes — and materially improved by this exercise (TD-065 fixed; `/api/metrics` is now genuinely scrapeable for the first time).
8. **Production build reproducible?** Yes — three separate live builds from the same tag/commit this session, all identical, all clean.
9. **CI operational?** Yes — the first genuinely green GitHub Actions run in this repository's history, confirmed twice (`rc.1`'s underlying commit and `rc.2`'s).
10. **Deployment reproducible?** Yes — live-tested three times (initial RC deploy, rollback, roll-forward).
11. **Rollback verified?** Yes — live-tested against the real `rc.1`↔`rc.2` pair, including confirming the rolled-back version's behavior (bug included) was genuinely restored, not just relabeled.
12. **Recovery verified?** Yes — this session's rollback/roll-forward cycle, plus PHD-001 Volume-4's own prior Redis-restart/container-restart exercises (cross-referenced, not repeated).
13. **Known Tech Debt explicitly accepted?** Yes — full disposition table above, with TD-041 specifically flagged rather than routinely waved through.
14. **Any release-blocking (P0) defects open?** **No.**

## Final release recommendation

# READY WITH ACCEPTED RISKS

**Candidate:** `v1.0.0-rc.2`, commit `b651eae456a23f1b14c2b2dbed76d0d1351e3de8`

The accepted risks are the honesty notes threaded through this report, not open defects: the full 7-role tenant permission matrix and the Platform-side functional journey were not freshly live-tested this session (existing automated test coverage stands, but wasn't independently re-verified by hand); TD-041's server-side enforcement gap should get explicit Architect sign-off rather than pass by default; and production smoke tests remain entirely untested pending a separate release-window authorization, per Decision 3 — this recommendation is for candidate readiness, not a claim that production itself has been verified.

No P0 (release-blocking) defect exists in anything tested. Two genuinely significant, previously-undiscovered defects were found and fixed during this exercise (the CI pipeline had likely never produced a true green run since 2026-08-13, and `/api/metrics` had likely never been scrapeable by real Prometheus since PHD-001 Volume-2) — both are now closed, verified at the level that actually matters (real HTTP/real GitHub Actions execution, not unit tests alone), and documented.
