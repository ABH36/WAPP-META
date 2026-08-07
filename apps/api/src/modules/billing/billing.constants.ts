/** Same hourly cadence as Communication's own sweeps (CONVERSATION_AUTO_CLOSE_SWEEP_INTERVAL_MS, SLA_ESCALATION_SWEEP_INTERVAL_MS) — trial/grace transitions don't need minute-level precision. */
export const SUBSCRIPTION_LIFECYCLE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export const SUBSCRIPTION_LIFECYCLE_QUEUE = "subscription-lifecycle";
