# Frontend Architecture

**Status:** Accepted
**Date:** 2026-08-10
**Scope:** FRD-001 Volume-1 — Frontend Architecture & Design System. How `apps/web`/`apps/admin` compose a real, working application shell (routing, auth, API layer, state management) on top of the frozen backend (PRD-001–007), without redefining anything the backend already owns.
**Implemented in:** `apps/web/src/{lib,types,services,stores,providers,middleware.ts,components/layout}`, `apps/admin/src/{lib,types,services,stores,providers,middleware.ts,components/layout}`, `packages/ui/src/lib/cookies.ts`

## Two-app topology confirmed, not introduced

FRD-001 Volume-1's own text describes one technology stack/folder structure/app shell, reading as if it proposes a single application. Architecture Review, 2026-08-10, resolved this by confirming what the repository already commits to: `apps/web` (Public Website + Workspace App) and `apps/admin` (Platform Administration console) are two separate deployables, per a document referenced throughout `docs/` as SDP-001 (not itself present in this repo — the same "relayed, not locally stored" category as the PRDs before each was shared) — already scaffolded, already building to separate Docker images (`docker/web.Dockerfile`, `docker/admin.Dockerfile`), already listed as three separate services in `docker-compose.prod.yml`, already split at the CORS layer (`WEB_APP_URL`/`ADMIN_APP_URL`). FRD-001 Volume-1's architecture — tech stack, folder structure template, API client pattern, state management approach, auth flow, design system — is the shared spec, applied independently to both apps. Nothing in this volume merges them.

## Every architectural piece exists once per app, never shared as a running instance

Per the Architect's approval: "Each application owns its own: App Router, API Client instance, Authentication Context, Layout, Navigation, State Stores... while sharing: Design Tokens, UI Components, Utility Functions, Types, Theme System through packages/ui." Concretely:

| Owned independently by each app                                                                  | Shared via `packages/ui`                                                                                         |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `lib/api.ts` (axios instance + interceptors)                                                     | `lib/cookies.ts` (pure browser utility, zero deps)                                                               |
| `stores/auth-store.ts`, `theme-store.ts`, `ui-store.ts`                                          | `tailwind.preset.ts` (DS-001 design tokens)                                                                      |
| `providers/*` (Query/Theme/Auth)                                                                 | Layout primitives (`Header`, `Sidebar`+`SidebarItem`, `Breadcrumb`, `Footer`, `Skeleton`+variants, `EmptyState`) |
| `middleware.ts`                                                                                  | `Button` (pre-existing)                                                                                          |
| `services/auth.service.ts` (different backend routes entirely — `/auth/*` vs `/platform/auth/*`) |                                                                                                                  |

`axios`, `zustand`, and `@tanstack/react-query` were deliberately **not** added as `packages/ui` dependencies, even though the interceptor/store/query-client code is structurally near-identical between the two apps — `packages/ui`'s existing dependency list (`class-variance-authority`, `clsx`, `framer-motion`, `lucide-react`, `tailwind-merge`) is UI/design-system-only, and adding networking/state libraries to it for ~150 lines of duplicated-but-simple logic wasn't judged to justify blurring that boundary.

## Token storage: memory-only access token, cookie-mirrored refresh token

The backend issues tokens in the JSON response body (`IssuedTokenPair`/`IssuedPlatformTokenPair`), never via `Set-Cookie` — it has no notion of a frontend origin. The frontend's own storage choice:

- **Access token** lives in the Zustand auth store, in memory only, never persisted. Every fresh page load starts with an empty store.
- **Refresh token** is mirrored into a plain (non-httpOnly) cookie (`wapp_web_rt` / `wapp_admin_rt` — deliberately distinct names, never shared, matching ADR-PLAT-002's identity separation) via `packages/ui`'s `cookies.ts` helper, specifically so Next.js `middleware.ts` — which runs on the Edge runtime and can only inspect request cookies/headers, never `localStorage` or Zustand state — has something to check for Protected/Guest Route redirects.

This is **not** a security boundary. A non-httpOnly cookie is exactly as readable to XSS as `localStorage` would have been — the choice is about what Edge middleware can see, not about hardening. `AuthProvider` (mounted once per app in the root layout) turns "a refresh-token cookie exists" into "the store is hydrated with a real user + access token" on every fresh load, via one silent `POST .../auth/refresh` + `GET .../auth/me` call — if there's no cookie, or the refresh fails, status becomes `unauthenticated` immediately, no network call attempted.

## Routing: presence-only middleware, matching BR-003's display-only philosophy

`middleware.ts` (one per app) checks only for the refresh-token cookie's _presence_, never its validity — the Edge runtime has no way to verify a JWT signature without shipping a secret to a public environment, and validity is re-checked by the backend on every real API call regardless (BR-004 — "Backend authorization is mandatory"). This extends the same "frontend permission rendering is convenience only" principle (BR-003) to navigation: a redirect based on a stale/expired cookie just means an extra round-trip through `AuthProvider`'s hydration failing and the user landing back at `/login` — never a security gap, since nothing sensitive was ever served from the redirect decision itself.

`apps/web`'s route classification: `GUEST_ONLY_PATHS` (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` — DS-001 §6's Authentication page list, not new routes invented here), `PUBLIC_PATHS` (`/`, until the Public Website module adds more), everything else protected by default. `apps/admin` has no public surface at all (AHD-001, PRD-007 — "never public-facing") — every route is protected except `/login`.

## A real, non-obvious bug caught during Runtime Verification: `.js`-extension imports silently broke webpack

Every new file in this volume initially used explicit `.js` extensions on relative imports (`from "./lib/api.js"`), mirroring `apps/api`'s convention (a real Node ESM runtime, where `.js` extensions are mandatory). `tsc --noEmit` passed cleanly with this everywhere — TypeScript's `moduleResolution: "Bundler"` setting (in `@wapp/config/typescript/nextjs.json`) type-checks a `.js`-suffixed import against a `.ts` source file successfully. But **Next.js's actual webpack bundler has no equivalent `resolve.extensionAlias` configured**, so at runtime every such import failed with `Module not found`, even though the exact same import passed static type-checking. This surfaced only when the dev server was actually booted (`next dev`), not during `tsc`/`eslint` — the same "real integration bugs surface at Runtime Verification, not before" pattern this engagement has hit repeatedly on the backend, now confirmed on the frontend too. Fixed by stripping `.js` from every relative import across both apps and `packages/ui` — the convention this codebase's pre-existing frontend files (e.g. `packages/ui/src/index.ts`'s own `export * from "./lib/cn"`) already used, which the new files should have matched from the start rather than copying the backend's convention.

A second, unrelated bug surfaced in the same verification pass: `middleware.ts` originally imported the full `lib/api.ts` (pulling in `axios` + the Zustand store) just for one cookie-name constant — needlessly heavy for the Edge runtime. Extracted into a dependency-free `lib/auth-cookie.ts`, imported by both `middleware.ts` and `lib/api.ts`.

## Testing: Vitest + React Testing Library, one config per package

No frontend test tooling existed anywhere in the repo before this volume — no config, no test script, no dependency. Vitest was chosen over Jest (the backend's tooling) specifically because it shares its transform pipeline with Vite/`@vitejs/plugin-react` rather than needing a separate ts-jest/babel-jest bridge, and because `NextRequest`/`NextResponse` (used directly in `middleware.test.ts`) work in a plain Vitest+jsdom environment without additional Next.js test-harness setup. Each of `packages/ui`, `apps/web`, `apps/admin` gets its own `vitest.config.ts` (not a shared `@wapp/config/vitest` preset) — the three configs differ only in a path alias, not worth centralizing yet at this size; revisit if a fourth frontend package makes the duplication real. `pnpm-workspace.yaml`'s `allowBuilds.esbuild` was flipped from a placeholder to `true` (Vitest's own dependency) — no other build-script approvals were needed.

## Production build: a known, environment-specific Windows limitation, not a code defect

`next build` for both apps compiles, type-checks, and generates every static page successfully (`✓ Compiled successfully`, `✓ Generating static pages (N/N)`). The build then fails at the `output: "standalone"` file-tracing step with `EPERM: operation not permitted, symlink ...` — a well-known Windows limitation (creating symlinks requires Developer Mode or an elevated shell; pnpm's `node_modules` is symlink-heavy, and standalone output tracing tries to replicate that structure). This is local-Windows-dev-environment-specific, not a code issue, and doesn't affect the actual Docker-based production build path `output: "standalone"` exists for (`docker/web.Dockerfile`/`docker/admin.Dockerfile` build inside Linux containers, where this limitation doesn't apply). Confirmed identical on both apps, ruling out an app-specific cause.
