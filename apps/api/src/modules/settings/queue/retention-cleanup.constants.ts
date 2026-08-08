export const RETENTION_CLEANUP_QUEUE = "retention-cleanup";

/** Same hourly cadence as every other lifecycle sweep in this codebase (Subscription/Invoice lifecycle, Conversation auto-close, SLA escalation). */
export const RETENTION_CLEANUP_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
