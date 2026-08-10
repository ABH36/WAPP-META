# Session Presentation Strategy

**Status:** Accepted
**Date:** 2026-08-10
**Scope:** FRD-001 Volume-2 §4.5/§4.6 — Active Sessions and Login History. How `apps/web`'s Profile area presents `GET /auth/sessions` and `GET /settings/security/login-history` data, and what's deliberately left for the backend to own.
**Implemented in:** `apps/web/src/features/auth/{sessions-list,login-history-list}.tsx`, `apps/web/src/lib/user-agent.ts`, `apps/web/src/app/(workspace)/profile/{sessions,login-history}/page.tsx`, `packages/ui/src/components/{session-card,login-history-table}.tsx`

## Sessions are presented as a flat list, ordered exactly as the backend returns them

`SessionsList` renders every session `GET /auth/sessions` returns via `SessionCard`, with no client-side reordering, grouping, or filtering. The backend already orders sessions meaningfully (most-recent-activity-first); re-sorting on the frontend would risk silently disagreeing with whatever ordering logic the backend considers canonical, for no display benefit. `revokeSession(id)` (via `auth.service.ts`) removes exactly the targeted session and refetches the list — no optimistic removal — so a revoke that fails server-side (session already expired, already revoked elsewhere) never shows a session as gone that the backend still considers present.

## No Current Session indicator — a real capability gap, not a display choice

`ADR-FE-003` covers the decision itself (resolved via `AskUserQuestion`, "ship without it"); this document records the presentation consequence. Every `SessionCard` renders identically regardless of whether it happens to be the session the user is viewing from — no highlighting, no "this device" label, no distinguishing sort position. This is enforced by a unit test (`session-card.test.tsx`) asserting the rendered output never contains current-session language, so a future edit can't silently reintroduce an unreliable heuristic without the test catching it.

## Device and browser text is parsed client-side from the User-Agent string, display-only

Both `SessionCard` (Active Sessions) and `LoginHistoryTable` (Login History) show a human-readable device/browser summary (e.g., "Chrome on Windows") derived from a raw `userAgent` string the backend stores and returns verbatim. `apps/web/src/lib/user-agent.ts` is a small, dependency-free parser (regex-based OS/browser detection, tested against 7 representative UA strings) rather than a library dependency — the accuracy bar here is "readable label for a human glancing at their own session list," not device fingerprinting or security-relevant identification. Nothing about session validity, authorization, or revocation logic depends on this parse; a misparsed or unrecognized UA string degrades to a generic fallback label, never an error state. This keeps the same BR-003-derived principle `ADR-FE-001` already applied to permission rendering — client-side interpretation is convenience/display only, never load-bearing.

## Login History is read-only, paginated by the backend, no client-side derived state

`LoginHistoryTable` has no actions (unlike `SessionCard`'s revoke) — `GET /settings/security/login-history` is a pure audit trail, and the UI reflects that by construction: no row is ever interactive beyond whatever the `Table` primitive itself provides (hover state), and pagination (if the backend response is paginated) is passed through rather than re-implemented client-side. Success/failure of each historical login attempt is rendered via the existing `Badge` component's status-color mapping, reusing `ADR-FE-002`'s `getStatusColor` convention rather than introducing a second badge-coloring scheme specific to login outcomes.

## Both lists load and error independently of the rest of the Profile area

`SessionsList` and `LoginHistoryList` each own their own TanStack Query key and loading/error boundary, scoped to their own tab (`/profile/sessions`, `/profile/login-history`). A failure fetching Login History never blocks or blanks out Active Sessions, and neither blocks the Profile Overview or Security tabs — the four-tab `profile/layout.tsx` navigation shell (from FRD-001 Volume-2 §4.4) renders unconditionally regardless of any one tab's data-fetch outcome.
