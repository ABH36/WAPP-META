/**
 * Auto-close threshold for RESOLVED conversations (BDC-012 — "Resolved ->
 * Closed via Auto-Close after configured inactivity"). Fixed platform-wide
 * for Part-2, not yet per-workspace configurable — see TD-003 in
 * docs/TECH-DEBT.md. Original module scope said "configurable duration";
 * this is a known, deliberate simplification, not an oversight.
 */
export const CONVERSATION_AUTO_CLOSE_HOURS = 24;

/** How often the auto-close sweep runs. */
export const CONVERSATION_AUTO_CLOSE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export const CONVERSATION_AUTO_CLOSE_QUEUE = "conversation-auto-close";
