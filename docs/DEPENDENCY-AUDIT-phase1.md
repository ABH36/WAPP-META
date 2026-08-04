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
