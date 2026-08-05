export const BROADCAST_EXECUTION_QUEUE = "broadcast-execution";

/** Batch size for pulling PENDING recipients per iteration — bounds memory use for a large Broadcast (docs/COMM-BROADCAST-LIFECYCLE.md's scaling note). */
export const BROADCAST_RECIPIENT_BATCH_SIZE = 50;

/** Small delay between individual sends within a batch — a basic, static courtesy toward Meta's own per-number rate limits, not a substitute for real throughput tuning (see docs/COMM-BROADCAST-LIFECYCLE.md). */
export const BROADCAST_SEND_DELAY_MS = 250;
