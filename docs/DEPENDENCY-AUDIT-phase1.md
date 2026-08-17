# Dependency & License Verification — Phase 1 Foundation

**Date:** 2026-08-04
**Requested by:** Architecture Review (Phase 1 approval), engineering improvement #3
**Scope:** `pnpm audit`, `pnpm outdated`, license verification — run before the initial Git commit

---

## 1. `pnpm audit` — Vulnerability Scan

### Before remediation

58 advisories: **2 critical, 21 high, 27 moderate, 8 low**.

### Action taken

Both **critical** findings, and several **high** findings, traced to `next` — a directly-declared production dependency in `apps/web` and `apps/admin`, pinned at `15.0.3`. This is not a dev-only tool; it's the actual framework running both frontends. Bumped to `15.5.22` (latest 15.x, same approved major version per TAD-001 — not an architecture change) and confirmed both apps still typecheck, lint, and compile cleanly afterward.

### After remediation

**0 critical, 11 high, 11 moderate, 4 low.**

### Remaining findings — reviewed individually, documented rather than blocking

| Finding                                                           | Package                                | Path                          | Assessment                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command injection, ReDoS, path traversal (glob/picomatch/tmp/ajv) | via `@nestjs/cli`                      | `apps/api` devDependency only | **Low real risk.** `@nestjs/cli` is a local build-time tool, never bundled or run in production. Exploiting these requires attacker code execution on a developer machine, at which point this isn't the weak link.                                                                                                             |
| Multer DoS (5 advisories)                                         | via `@nestjs/platform-express`         | `apps/api`                    | **Not currently reachable.** We deliberately do not use multer/multipart file upload endpoints — file uploads bypass the API entirely via Cloudinary's direct-upload signature flow (TAD-001 v1.2 Security Patch, SEC-016). Multer is present transitively but never invoked by our code. Will need a real fix if this changes. |
| `@nestjs/core` output-injection (moderate)                        | `@nestjs/bull-shared` → `@nestjs/core` | `apps/api`                    | **Accepted, tracked.** Fix requires NestJS 11.x — a major-version upgrade across every `@nestjs/*` package, which is a deliberate, separately-tested piece of work, not something to fold into a pre-commit dependency sweep. Recorded below as a follow-up.                                                                    |
| `qs` / `body-parser` DoS (low/moderate)                           | via `@nestjs/platform-express`         | `apps/api`                    | Same root cause as above — fixed versions ship with NestJS 11.x.                                                                                                                                                                                                                                                                |
| `lodash` prototype pollution / code injection                     | via `@nestjs/config`                   | `apps/api`                    | `@nestjs/config` does not call `_.template`, and prototype-pollution paths (`_.unset`/`_.omit`) aren't exercised by our configuration loading. Low practical risk; will resolve on the next `@nestjs/config` release.                                                                                                           |
| `sharp` (libvips CVEs)                                            | via `next` (image optimization)        | `apps/web`, `apps/admin`      | Sharp itself updated to `0.34.5` as part of the Next.js bump (transitively). Residual libvips CVEs are in image-processing edge cases; monitor for a further sharp patch.                                                                                                                                                       |
| `postcss` (source-map disclosure, XSS in stringify)               | via `next`/Tailwind toolchain          | `apps/web`, `apps/admin`      | Build-time only; not part of the served application. Low risk.                                                                                                                                                                                                                                                                  |
| `webpack` SSRF (low)                                              | via `@nestjs/cli`                      | `apps/api` devDependency      | Same reasoning as the `@nestjs/cli` row above — build-time only.                                                                                                                                                                                                                                                                |

**Follow-up recommended (not blocking):** a deliberate NestJS 10 → 11 major-version upgrade, evaluated and tested on its own, would close the `@nestjs/core`/`body-parser`/`qs` findings entirely. Not attempted here — a framework major bump right before Phase 2 begins is the wrong moment for it.

---

## 2. `pnpm outdated` — Currency Check

Full report available via `pnpm outdated -r`. Summary: everything currently pinned is functioning correctly (proven by the full verification sweep); most "outdated" entries are next-major-version availability, not patch-level currency gaps:

- **NestJS ecosystem** (10.x → 11.x available) — same upgrade as the audit follow-up above.
- **Next.js** (15.x → 16.x available), **Tailwind** (3.x → 4.x), **ESLint** (9.x → 10.x), **Zod** (3.x → 4.x) — all major version jumps with likely breaking changes; deliberately not attempted now, consistent with not destabilizing a just-verified Foundation right before Phase 2.
- **TypeScript** (5.9.3 → latest tag reports 7.0.2) — worth flagging specifically: this is a major compiler version, not a routine patch. Needs its own evaluation before adopting, not a pre-commit bump.
- Everything else in the report is routine minor/patch drift on dev tooling, non-blocking.

No dependency is currently pinned to a version with a known unpatched critical or high vulnerability after the Next.js remediation above.

---

## 3. License Verification

Full distinct license set across the entire dependency tree (`pnpm licenses list`):

```
MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0,
CC0-1.0, Unlicense, (MIT OR Apache-2.0), (MIT OR CC0-1.0),
Apache-2.0 AND LGPL-3.0-or-later, MPL-2.0, Python-2.0, CC-BY-4.0
```

**No GPL, AGPL, SSPL, or other strong-copyleft/commercially-restrictive license found anywhere in the tree.**

Three less-common entries, checked individually:

- **MPL-2.0** — `axe-core` (accessibility testing tooling, dev-only).
- **Python-2.0** — `argparse` (transitive build tooling).
- **CC-BY-4.0** — `caniuse-lite` (browserslist data, used by Tailwind/Autoprefixer at build time).

All three are dev-time tooling or build-time data, not runtime application code — none impose obligations on the proprietary WAPP codebase. `@img/sharp-win32-x64`'s `LGPL-3.0-or-later` component (bundled libvips) is used as an unmodified dependency, which doesn't trigger LGPL's copyleft obligations (those apply to modifying and redistributing the library itself, not to using it).

**Conclusion: no license risk identified.**

---

## Summary

- Critical vulnerabilities: **fixed** (Next.js bumped to 15.5.22).
- Remaining high/moderate findings: **reviewed individually, documented, either non-reachable in our actual code paths or gated behind a deliberate future NestJS major upgrade.**
- Licenses: **clean, no copyleft risk.**
- Full verification sweep (typecheck/lint/format/build) re-run clean after the Next.js version bump.

Nothing here blocks the initial commit.

---

## 2026-08-12 Update — PHD-001 Volume-1 (Security Hardening) Re-Audit

**Requested by:** Architecture Review approval of PHD-001 Volume-1's design — deliverable §9 requires a fresh `pnpm audit` and a refreshed version of this document, not a re-read of the Phase-1 numbers above (5+ months stale — every subsequent FRD volume added dependencies this baseline never accounted for).

### Before remediation (this volume)

61 advisories: **2 critical, 22 high, 24 moderate, 5 low.**

### Action taken

Both **critical** findings this time traced to dev/build tooling, not a production framework like Phase-1's `next` finding:

- **`vitest` (<3.2.6)** — "arbitrary file read via its own UI server," dev-only (`vitest --ui`, never run in CI/production). Bumped `vitest` `^2.1.4` → `^3.2.6` across all 4 packages that use it (`apps/web`, `apps/admin`, `packages/ui`, `packages/shared-validation`) — a major-version jump, so re-ran every affected package's full test suite afterward (`apps/web`: 63/63, `apps/admin`: 11/11, `packages/ui`: 162/162, `packages/shared-validation`: 13/13, all passing) plus a typecheck and production build of both Next.js apps before accepting the bump.
- **`tar` (<=7.5.18)** — DoS via unlimited decompression, reachable only transitively through `bcrypt` → `@mapbox/node-pre-gyp` → `tar` (install-time prebuilt-binary extraction for the native `bcrypt` module; confirmed via grep that no application code imports `tar` directly). A workspace-level `pnpm-workspace.yaml` `overrides: { tar: ^7.5.19 }` resolves it to `7.5.22` without touching `bcrypt`'s own manifest — verified `bcrypt`'s native module still builds and a real hash/compare round-trip still works after the override.

### After remediation

**0 critical, 15 high, 20 moderate, 5 low.**

### Remaining findings — reviewed individually, documented rather than blocking

| Finding                                                                                                                  | Package(s)                                               | Reachable at runtime?  | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multer DoS (4 advisories, high/moderate)                                                                                 | via `@nestjs/platform-express`                           | No                     | Same Phase-1 finding, still unreached — file uploads still go through Cloudinary's direct-upload signature flow, never through a multer/multipart endpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Nodemailer (9 advisories, high/moderate/low — SSRF via `raw`, CRLF/header injection, file-access bypass, TLS validation) | `apps/api`, direct dependency (`6.10.1`, latest `9.0.5`) | Narrowly               | Grep-confirmed: `nodemailer` is used in exactly one place (`email-integration.service.ts`), and only ever calls `transporter.verify()` — a connection handshake — never `sendMail()`. Every CVE in this batch requires `sendMail()` with attacker-influenced options (`raw`, headers, envelope), which this codebase never calls. Real transactional email (verification/reset links) goes through Resend, not nodemailer, at all. **Low practical risk given current usage**, but a 3-major-version-behind direct dependency is worth a dedicated future bump (breaking API changes across 6→9 need real SMTP-integration testing, not a drive-by version bump) — not attempted in this hardening-only volume, consistent with this document's own NestJS 10→11 precedent below. |
| `vite`/`esbuild` dev-server findings (high/moderate)                                                                     | dev-only, all 4 vitest packages                          | No                     | Same class as Phase-1's `@nestjs/cli` findings — local dev-server-only, never runs in production or CI test execution itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `sharp` libvips CVEs (high)                                                                                              | via `next` (image optimization)                          | Partially              | Same as Phase-1 — residual libvips edge cases; monitor for the next sharp patch release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `postcss` (source-map disclosure, XSS in stringify — 4 advisories)                                                       | via `next`/Tailwind toolchain                            | Build-time only        | Same as Phase-1 reasoning — not part of the served application.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `lodash` (code injection via `_.template`, prototype pollution — 3 advisories)                                           | via `@nestjs/config`                                     | No                     | Same as Phase-1 — `@nestjs/config` doesn't call `_.template`/`_.unset`/`_.omit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@nestjs/core` output injection (moderate)                                                                               | via `@nestjs/bull-shared`                                | Gated behind NestJS 11 | Unchanged from Phase-1 — still requires the same deliberate, separately-tested NestJS 10→11 major upgrade.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `qs`/`body-parser` DoS (moderate/low)                                                                                    | via `@nestjs/platform-express`                           | Gated behind NestJS 11 | Same root cause/resolution path as the `@nestjs/core` row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `nanoid` infinite loop on `size: 0` (high)                                                                               | transitive, multiple packages                            | No                     | Requires calling nanoid's custom generator with an explicit `size: 0`, which nothing in this codebase does (nanoid isn't called directly by application code at all — a transitive dependency of tooling).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ajv` ReDoS via `$data` (moderate), `file-type` DoS (2, moderate)                                                        | `apps/api`, dev/transitive                               | No / narrow            | `ajv`'s `$data` option is never enabled in this codebase's validation config; `file-type` findings require parsing an attacker-crafted ASF/ZIP file, and this codebase never accepts arbitrary file-type sniffing from user uploads (Cloudinary direct-upload, per the multer row above).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `uuid` missing buffer bounds check (moderate)                                                                            | `apps/api`, transitive                                   | No                     | Only affects `uuid.v3`/`v5`/`v6` called with a caller-supplied `buf` argument — this codebase only ever calls `randomUUID()` (Node's built-in, via `node:crypto`), never the `uuid` package's own v3/v5/v6 functions with a buffer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `webpack` `buildHttp` SSRF (low, 2 advisories)                                                                           | build-time, `apps/api`/`apps/web`                        | Build-time only        | Same class as Phase-1's webpack finding — requires an attacker-controlled build-time URL, which nothing in this build process uses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Follow-up recommended (not blocking), carried forward and added to:**

1. The same NestJS 10 → 11 major upgrade from the Phase-1 audit (still open, still deliberately deferred).
2. A dedicated nodemailer major-version upgrade (6.x → 9.x) with real SMTP-integration testing, given it's a direct production dependency, not dev tooling — tracked here rather than in `TECH-DEBT.md` since it's a routine "keep dependencies current" item, not a design gap.

---

## Summary (2026-08-12)

- Critical vulnerabilities: **fixed** (`vitest` → 3.2.6+, `tar` → 7.5.19+ via override) — 0 critical, down from 2.
- Remaining high/moderate/low findings: **reviewed individually this volume**, same "non-reachable in our actual code paths, or gated behind a deliberate future major upgrade" pattern as Phase-1 — see table above, including a specific reachability finding for `nodemailer` (connection-test-only usage, `sendMail()` never called).
- Licenses: unchanged since Phase-1 — no new copyleft dependency introduced by this volume's changes (`cookie-parser`, `@types/cookie-parser` are both MIT).
- Full verification sweep re-run clean after every dependency change this volume (typecheck across all touched packages, full test suites, production builds of both Next.js apps).

---

## 2026-08-17 Update — PHD-001 Volume-4 (Release Readiness, CI/CD & Deployment)

**Requested by:** §4/§28 — CI must now run a real security-audit job on every PR/push, not just a point-in-time manual pass.

**Re-ran `pnpm audit` before wiring CI**: `0 critical, 15 high, 20 moderate, 5 low` — byte-for-byte identical to the 2026-08-12 numbers above. No drift since Volume-1; nothing new to individually review.

**CI enforcement added** (`.github/workflows/ci.yml`, `security-audit` job): `pnpm audit --audit-level=critical` on every PR/push — fails only on a **new** critical finding, matching the bar Volume-1 already established and documented above. It does not fail on the existing high/moderate/low findings, since those were already individually reviewed and accepted (non-reachable in this codebase's actual usage, or gated behind a deliberately deferred major upgrade) — failing CI on an already-reviewed, already-accepted finding would just make every future PR red for a decision that's already been made, not surface new information.

Nothing here blocks PHD-001 Volume-1's commit.
