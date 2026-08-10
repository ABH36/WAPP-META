/**
 * §11/Security Requirements — "An ACTIVE session must never remain valid
 * after its expiration time." The real enforcement is the real-time
 * `expiresAt > now` check in `SupportSessionRepository.
 * findActiveForWorkspaceAndUser` (used by every gated read), not this
 * sweep's cadence — this interval only keeps the `status` field itself
 * accurate for reporting/audit, so it's deliberately much tighter than
 * Billing's hourly sweeps (trial/grace transitions don't need minute-level
 * precision; a stale-looking "ACTIVE" session on an audit screen would be
 * actively misleading).
 */
export const SUPPORT_SESSION_LIFECYCLE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const SUPPORT_SESSION_LIFECYCLE_QUEUE = "support-session-lifecycle";
