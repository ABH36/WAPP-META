# Authentication Threat Model

**Scope:** `apps/api/src/modules/identity` (Phase-2, Identity & Authentication Module)
**Date:** 2026-08-04
**Purpose:** Reference document for future security audits and for evaluating any future change to the auth flow. Documentation only — does not gate or block implementation.

For each threat: what it is, how the current implementation mitigates it, and what residual risk or future work remains.

---

## 1. Replay attacks

**Threat:** An attacker captures a valid request (e.g. a login response or an API call) and re-sends it later to repeat its effect.

**Mitigation:**

- Access tokens are short-lived (15 minutes) — a captured token has a small usable window.
- All auth traffic is expected to run over TLS in staging/production (terminated at the reverse proxy per SDP-001/TAD-001 deployment architecture), which prevents on-path capture in the first place; this document assumes transport security is in place and does not re-litigate it.
- Single-use tokens (email verification, password reset) are marked `usedAt` on first use — a captured verification/reset link cannot be replayed a second time even within its TTL window.

**Residual risk / future work:** None specific to Identity beyond standard TLS hygiene, which is an infrastructure/deployment concern, not an application-layer one.

---

## 2. JWT theft (access token)

**Threat:** An attacker obtains a valid access token (XSS, malicious browser extension, log leakage, etc.) and uses it to impersonate the user.

**Mitigation:**

- Access tokens are short-lived (15 minutes) — the blast radius of a stolen token is time-boxed.
- Access tokens carry no sensitive data beyond `sub`/`workspaceId`/`role`/`emailVerified` — no password, no PII.
- Access tokens are stateless/unrevocable by design (standard JWT tradeoff) — there is currently no server-side access-token blocklist.

**Residual risk:** A stolen access token remains valid for up to 15 minutes with no way to revoke it early. Accepted for Phase-1 given the short TTL; if this becomes a real concern (e.g. a confirmed incident), the standard fix is a short-lived server-side revocation list (Redis-backed, checked in `JwtAuthGuard`) rather than shortening the TTL further.

**Where the token is stored** is a frontend/Phase-6 concern (httpOnly cookie vs. memory vs. localStorage) — not yet decided, since no frontend consumes these endpoints yet. **Flagged for the Frontend phase**: storing the access token in `localStorage`/`sessionStorage` is XSS-exposed; an httpOnly cookie (with the refresh token, see below) is the safer default and should be the starting assumption unless there's a specific reason to deviate.

---

## 3. Session hijacking / refresh token theft

**Threat:** An attacker obtains a valid refresh token and uses it to mint new access tokens indefinitely, maintaining persistent access even after the original access token expires.

**Mitigation:**

- Refresh tokens are backed by a server-side `Session` record — revocable at any time (`logout`, `logout-all`, or an explicit `DELETE /auth/sessions/:id`), unlike the stateless access token.
- **Rotation on every use**: each `/auth/refresh` call issues a brand-new refresh token and immediately revokes the one just used. A refresh token is single-use.
- **Reuse detection**: if an already-revoked (already-rotated) refresh token is presented again, the system treats this as evidence of theft — a legitimate client would never do this, since it always uses the newest token — and revokes **every** session belonging to that user, forcing re-authentication everywhere. This is the standard "refresh token rotation with automatic reuse detection" pattern (OWASP-recommended for this exact threat).
- Sessions carry `userAgent`/`ipAddress` (recorded, not currently used for anomaly detection) and are independently listable/revocable via `GET /auth/sessions`.

**Residual risk:** Reuse detection only triggers _after_ an attacker has raced ahead of the legitimate client (i.e., the attacker uses the stolen token before the legitimate client does). If the attacker uses it first, the legitimate client's next refresh attempt fails and is the one that triggers the full-revocation response — the attacker is still locked out, but the legitimate user experiences an unexpected forced logout. This is a known, accepted tradeoff of the rotation-with-reuse-detection pattern, not a gap specific to this implementation.

---

## 4. Token reuse (across purposes)

**Threat:** A token issued for one purpose (e.g. email verification) is accepted where a different-purpose token (e.g. password reset) was expected.

**Mitigation:**

- `AuthToken.type` (`EMAIL_VERIFICATION` / `PASSWORD_RESET`) is part of the lookup query (`findValidByHash(hash, type)`) — a verification token's hash simply won't match a password-reset lookup, regardless of validity/expiry. Cross-purpose reuse is structurally impossible, not just policy-disallowed.
- Access and refresh JWTs are signed with **separate secrets** (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) and carry a `type` field checked on verification — a refresh token cannot be presented as an access token or vice versa.

**Residual risk:** None identified.

---

## 5. Password attacks (guessing, brute-force, credential stuffing)

**Threat:** An attacker attempts many passwords against one account (brute-force) or one password against many accounts (credential stuffing, using breached password lists).

**Mitigation:**

- Passwords hashed with bcrypt (cost 12) — computationally expensive to brute-force offline even if the database were ever exfiltrated.
- Password policy enforced at registration/reset: minimum 8 characters, at least one uppercase, one lowercase, one digit (`packages/shared-validation`, mirrored in API DTOs).
- Rate limiting: 5 requests/minute on `login` (and `register`, `forgot-password`, `resend-verification`) — SEC-009.
- Account lockout: 5 consecutive failed attempts locks the account for 15 minutes (see **AUTH-001**, `docs/ADR-AUTH-001-account-lockout-policy.md`).

**Residual risk:**

- No breached-password check (e.g. Have I Been Pwned k-anonymity API) — a user can set a password that's technically "strong" by the regex but is a known-breached value. Not implemented in Phase-1; worth considering for a future hardening pass.
- Lockout is per-account, not per-IP — a credential-stuffing attack spread across many different accounts from one IP is only slowed by the general rate limit, not blocked by account lockout (each individual account only sees 1 attempt, never reaching the 5-attempt threshold). This is a known gap, noted in `docs/TECH-DEBT.md`-adjacent territory; a WAF/edge-level IP reputation layer is the standard complementary control, out of scope for the application layer.

---

## 6. Enumeration attacks

**Threat:** An attacker uses differences in system responses (error messages, response timing, status codes) to determine whether a given email/account exists, for use in a subsequent targeted attack.

**Mitigation:**

- `login` returns the identical generic `"Invalid email or password"` message whether the email doesn't exist or the password is simply wrong.
- **Timing**: when the email doesn't exist, the login handler still runs a full bcrypt comparison (against a fixed dummy hash) before responding, so a nonexistent-email response isn't measurably faster than a wrong-password response.
- `resend-verification` and `forgot-password` always return the same generic "if an account exists..." message and perform no observable side effect (no email sent) when the account doesn't exist or is already verified.
- `register`'s duplicate-email/duplicate-mobile responses (409) are an intentional, accepted exception — REG-BR-002/003 requires informing the user which field conflicts so they can correct it, and this is a self-service registration form, not a targeted-attack-relevant surface in the same way login is.

**Residual risk:** None identified for the mitigated endpoints. The `register` exception is a deliberate, documented UX/security tradeoff, not an oversight.

---

## 7. CSRF (Cross-Site Request Forgery)

**Threat:** A malicious site tricks an authenticated user's browser into making a state-changing request to the API using the user's existing credentials (typically exploiting cookie-based auth).

**Current status:** **Not yet applicable / not yet implemented.** These endpoints are stateless bearer-token (`Authorization: Bearer <token>`) APIs, not cookie-session-based — CSRF specifically targets ambient credentials (cookies) that browsers attach automatically; a bearer token in a header is not automatically attached by the browser, so classic CSRF does not apply to the current transport.

**This changes if the Frontend phase decides to store the access/refresh token in an httpOnly cookie** (see §2 residual risk) — at that point, CSRF protection (double-submit cookie token, `SameSite=Strict`/`Lax`, or a synchronizer token) becomes mandatory (TAD-001 v1.2 SEC-012) and must be implemented alongside that decision, not after. **Flagged as a hard dependency**: the cookie-storage decision and CSRF protection must ship together.

---

## 8. XSS (Cross-Site Scripting)

**Threat:** Injected script in the frontend reads tokens, session data, or performs actions as the logged-in user.

**Mitigation (application-layer, already in place):**

- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` strips any unexpected fields from every request before it reaches a service — first line of output sanitization (nothing unexpected can be stored and later reflected).
- Helmet's CSP (`script-src 'self'`, no `unsafe-inline` for scripts) is applied globally (SEC-013), reducing the impact of any injected script by restricting what it's allowed to execute/load.
- Identity's own responses contain no user-controlled HTML — `fullName`, `email` etc. are returned as plain JSON string fields, never rendered server-side into HTML.

**Residual risk:** XSS defense is fundamentally a frontend-rendering concern (React's default JSX escaping covers most of it) — this module's contribution is limited to not being an injection _source_. Full closure of this threat depends on the Frontend phase's rendering discipline, out of this module's scope.

---

## 9. Rate limiting

**Threat:** Any high-volume automated abuse — brute-force, enumeration probing, resource exhaustion — against auth endpoints specifically (the highest-value target surface, since it's the one place unauthenticated requests can trigger meaningful backend work: bcrypt hashing, email sends, DB writes).

**Mitigation:**

- `register`, `login`, `resend-verification`, `forgot-password` are throttled to **5 requests/minute** (SEC-009), enforced via Redis-backed `ThrottlerGuard` — verified live (429 responses observed under test) and in the e2e suite.
- General API default (all other authenticated routes): 300 requests/minute (`ThrottlerModule.forRoot` default tier in `AppModule`).
- Throttling is IP-based (NestJS Throttler default) — see §5 residual risk for the corresponding gap (doesn't stop a low-volume-per-account, wide-account-spread attack).

**Residual risk:** IP-based throttling is bypassable by an attacker with access to many IPs (botnet, proxy rotation). Standard complementary control is an edge/WAF layer (e.g. Cloudflare, AWS WAF) with IP reputation and geographic/behavioral heuristics — an infrastructure-layer decision for the Deployment phase, not an application-layer gap in this module.

---

## Summary Table

| Threat                            | Mitigated                                | Residual Risk                                             |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| Replay attacks                    | ✅                                       | None (assumes TLS)                                        |
| JWT theft (access token)          | ✅ (short TTL)                           | No early revocation; storage decision pending (Frontend)  |
| Session hijacking / refresh theft | ✅ (rotation + reuse detection)          | Race-condition UX edge case (accepted tradeoff)           |
| Token reuse across purposes       | ✅                                       | None                                                      |
| Password attacks                  | ✅ (bcrypt, lockout, rate limit)         | No breached-password check; per-IP stuffing gap           |
| Enumeration attacks               | ✅                                       | None (register 409 is a deliberate exception)             |
| CSRF                              | N/A (bearer token, not cookies)          | **Must be implemented if/when cookie storage is adopted** |
| XSS                               | Partial (CSP, no server-side reflection) | Depends on frontend rendering discipline                  |
| Rate limiting                     | ✅ (5/min auth, Redis-backed)            | IP-based only; no WAF/edge layer yet                      |

**Hard dependency flagged for the Frontend phase:** the token-storage decision (cookie vs. memory) and CSRF protection are coupled — do not ship httpOnly-cookie storage without CSRF protection landing in the same change.
