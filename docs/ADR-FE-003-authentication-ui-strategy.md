# Authentication UI Strategy

**Status:** Accepted
**Date:** 2026-08-10
**Scope:** FRD-001 Volume-2 — Authentication & Identity UI. How `apps/web`/`apps/admin` implement Login, Forgot/Reset Password, Change Password, Profile, and the authentication guards on top of the frozen Identity (PRD-002) and Settings (PRD-005) backends, without re-owning logic either module already owns.
**Implemented in:** `apps/web/src/{features/auth,services,types,lib}`, `apps/admin/src/{features/auth,lib}`, `packages/shared-validation/src/primitives/contact.schema.ts`, `packages/ui/src/components/{input,password-input,password-strength-indicator,card,alert,badge}.tsx`

## Frontend service split mirrors the backend's own Identity/Settings orchestration boundary

`ADR-SET-004-identity-orchestration-strategy.md` establishes that Identity remains the sole owner of authentication logic, and Settings only orchestrates a subset of it (`SecuritySettingsController` wraps `POST /settings/security/change-password` and `GET /settings/security/login-history`, both of which still delegate to Identity underneath). The frontend mirrors this exactly rather than flattening it: `apps/web/src/services/auth.service.ts` (login, refresh, logout, `logoutAll`, `sessions`, `revokeSession`, forgot/reset password — all genuinely Identity's own routes) is a separate file from the new `apps/web/src/services/security-settings.service.ts` (`changePassword`, `loginHistory` — Settings' orchestrated routes). Collapsing these into one `auth.service.ts` would have been simpler to write, but would have erased a distinction the backend itself considers architecturally meaningful. Any future frontend consumer of Change Password or Login History imports from `security-settings.service.ts`, not `auth.service.ts` — the file boundary is the enforcement mechanism.

## Shared password validation closes part of TD-001, deliberately not all of it

`packages/shared-validation`'s `passwordSchema` gained `.max(128)` to match the backend's own bound, and a new `PASSWORD_POLICY_RULES` array (`minLength`/`maxLength`/`uppercase`/`lowercase`/`digit`, each `{id, label, test}`) now drives `PasswordStrengthIndicator`'s live checklist on every password-entry form (Reset Password, Change Password). This is the "single source of truth" `TD-001` in `docs/TECH-DEBT.md` already named, now finally consumed by the frontend it always intended to serve — the Zod schema itself was already exported, just unused until this volume. This is a **partial** closure only: `apps/api`'s Identity DTOs still hand-replicate the same rules as `class-validator` decorators; nothing about the backend's own duplication (the actual subject of TD-001) changed. See `docs/TECH-DEBT.md`'s TD-001 entry for the disposition note.

`PasswordStrengthIndicator` (`packages/ui/src/components/password-strength-indicator.tsx`) takes a generic `rules: PasswordRuleCheck[]` prop rather than importing `@wapp/shared-validation` directly — `packages/ui` stays UI/design-system-dependency-only (the same boundary `ADR-FE-001` already drew around `axios`/`zustand`), and each app passes `PASSWORD_POLICY_RULES` in at the call site instead.

## Login Form and Security Settings Panel are patterns, not shared components

DS-001 §4 and FRD-001 Volume-2 §6 both name "Login Form" and "Security Settings Panel" as components to introduce. Both were built per-app (`apps/web/src/features/auth/*`, and the equivalent forms under `apps/admin/src/features/auth/*`), not added to `packages/ui`. Their actual behavior — which service module they call, which Zustand store they write to, which route they redirect to on success — is inherently app-specific, the same reasoning `ADR-FE-001` already applied to each app owning its own Authentication Context. `packages/ui` only gained the presentational primitives these forms compose: `Input`, `PasswordInput`, `PasswordStrengthIndicator`, `Card`, `Alert`, `Badge`. A shared `LoginForm` component would need either a prop-injected service (defeating the point of a shared component) or a hardcoded backend route (wrong for `apps/admin`'s `/platform/auth/*` routes) — neither was worth the abstraction for two call sites.

## Remember Me is a client-only preference, re-applied on every silent refresh, not just at login

The backend has no server-side concept of "remember me" — no field on the refresh-token issuance, no differing expiry by request. The entire mechanism lives in the frontend cookie layer: `packages/ui/src/lib/cookies.ts`'s `setCookie(name, value, maxAgeSeconds?)` had its third parameter made optional — omitting it produces a session cookie (no `Max-Age` attribute, cleared when the browser closes) instead of the previous hardcoded persistent expiry.

The user's choice is persisted independently of the login form itself, in a new `lib/remember-me.ts` per app (`getRememberMe()`/`setRememberMe()`/`refreshTokenCookieMaxAge()`, backed by `wapp_web_remember_me` / `wapp_admin_remember_me` in `localStorage`, defaulting to persistent/`true` when unset). This is necessary, not incidental: both `lib/api.ts`'s response interceptor and `providers/auth-provider.tsx`'s hydration flow re-issue the refresh-token cookie on every silent token refresh, not just at the initial login. If the choice were only applied once at login time, an unchecked "Remember Me" would silently become persistent again on the very first automatic refresh, defeating the setting entirely. Every cookie-writing call site — login, refresh interceptor, hydration — now reads `refreshTokenCookieMaxAge()` at write time rather than a constant.

## Login response is the full profile; the auth store's canonical shape is thinner

`apps/admin`'s `authService.login()` returns the complete `PlatformUserProfile` the backend's `/platform/auth/login` response body actually contains. `useAuthStore.setSession()`'s parameter type is the narrower `PlatformUser` (`{platformUserId, role}` — the same shape `GET /platform/auth/me` returns, and the only shape most of the app needs after hydration). The new login form narrows explicitly at the one call site that has the fuller object available:

```ts
setSession({ platformUserId: user.id, role: user.role }, tokens.accessToken);
```

This was anticipated in `ADR-FE-001` as a designed consequence of `/auth/me` and `/auth/login` having different response shapes, not a new decision — this volume is the first place it's actually exercised in real code.

## Reset Password: no client-side token pre-validation, matching an explicit backend limitation

`apps/web`'s Reset Password page accepts a `token` query param and only discovers validity/expiry when the user actually submits a new password — the backend has no `GET`-style "is this token still valid" endpoint. Per the Architecture Review's explicit instruction, no additional pre-validation endpoint or client-side workaround was introduced to paper over this; an invalid/expired token surfaces as a normal `ApiError` from the submit call, displayed verbatim (see below), same as any other form failure.

## Error and disclosure messages are always the backend's own text, never re-authored

Forgot Password's no-such-account response, Change Password's session-revocation notice, and every `ApiError` surfaced across these forms render the backend's message field directly rather than a frontend-authored paraphrase. This was a deliberate choice, not an oversight: authoring custom copy risks silently drifting from, or under-disclosing, whatever security/business guarantee the backend message was actually written to convey (e.g., Forgot Password's account-enumeration-resistant wording is backend-owned; a rephrased frontend version could reintroduce the exact enumeration signal the backend message was designed to avoid).

## Current Session indicator: shipped without one, by explicit resolution

No backend field (`isCurrent`, or a `jti` present in the access token) exists to reliably identify which of a user's sessions is the one currently in use. Rather than approximate this client-side (e.g., matching device/IP heuristically, which is unreliable and was explicitly rejected as a "no backend mechanism, no frontend heuristic" case), this volume's one open design question was resolved via `AskUserQuestion`: ship without a Current Session indicator this volume. `SessionCard`'s component test (`session-card.test.tsx`) asserts no "current"/"this device" text ever renders, enforcing the decision rather than just documenting it. Revisiting this is a backend change (exposing session identity in the token or `/auth/sessions` response), not a frontend one — no action item exists on the frontend side.
