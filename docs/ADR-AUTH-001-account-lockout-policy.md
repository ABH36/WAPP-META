# AUTH-001 — Account Lockout Policy

**Status:** Accepted
**Type:** Technical security decision (engineering-level, not a Business Decision Log entry — no product/business behavior is affected)
**Owner:** Chief Software Engineer & Technical Lead
**Date:** 2026-08-04
**Implemented in:** `apps/api/src/modules/identity` (Phase-2, Identity & Authentication Module)

## Context

TAD-001's Security Standards mandate a general "security baseline" including brute-force protection, but do not pin an exact lockout threshold/duration. SEC-009 (5 requests/minute rate limiting on auth endpoints) protects against high-volume automated attacks but does not, by itself, stop a low-and-slow credential-guessing attempt spread out under the rate limit. A dedicated account-level lockout is the standard complementary control.

## Decision

- After **5 consecutive failed login attempts** for an account, the account is locked for **15 minutes**.
- The counter (`User.failedLoginAttempts`) resets to zero on any successful login.
- Lockout is enforced _before_ the password comparison runs (a locked account is rejected without touching bcrypt), so a locked-out attacker cannot use response timing to keep testing passwords during the lockout window.
- Lockout state (`lockedUntil`) is also cleared whenever the password is changed via the reset-password flow, since that flow already re-authenticates the user via a possession-based token (the emailed reset link) and revokes all existing sessions.
- Both values are environment-configurable (`MAX_FAILED_LOGIN_ATTEMPTS`, `ACCOUNT_LOCKOUT_MINUTES`, defaults 5 / 15) rather than hardcoded, so they can be tuned per environment without a code change.

## Alternatives Considered

- **No account-level lockout, rate-limiting only**: rejected — SEC-009's per-IP/per-route rate limit doesn't stop a distributed or slow-paced credential-stuffing attempt against one specific account.
- **Permanent lock requiring manual/support unlock**: rejected for Phase-1 — meaningfully higher support burden for a B2B SMB customer base, and no self-service or Platform Admin unlock capability exists yet to resolve it. A time-boxed lock was judged the better tradeoff between security and support load; revisit if abuse patterns are observed in production.
- **Exponential backoff per attempt** (progressively longer locks): rejected as unnecessary complexity for Phase-1 — a flat 5/15 threshold is simple to reason about and audit; can be revisited if the flat policy proves insufficient.

## Consequences

- A legitimate user who forgets their password 5 times is locked out for 15 minutes; the forgot-password flow remains available during lockout (it does not check `lockedUntil`) as the user's escape hatch.
- This is an engineering-level decision made under the existing "security baseline" mandate in the Engineering Standards document — it does not require a Business Decision Log entry, but is recorded here per the Decision Log discipline (finalized decisions must be documented, not left as an undocumented implementation detail).

## Future Work

- Consider a Platform Admin "unlock account" capability once Platform Administration tooling exists (PRD-007) — currently a locked-out user has no path except waiting out the 15-minute window.
- Consider IP-based/device-fingerprint-based signals in addition to the per-account counter if credential-stuffing patterns are observed after launch.
