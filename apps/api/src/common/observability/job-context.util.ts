/** PHD-001 Volume-2 §4.2 — every BullMQ job's data shape includes this. */
export interface JobContext {
  correlationId: string;
}

/**
 * Attaches the current correlation ID to a job's data at enqueue time —
 * the single shared implementation every enqueue call site uses, rather
 * than 11 independent hand-rolled copies (Architecture Review finding).
 */
export function withCorrelationId<T extends object>(
  data: T,
  correlationId: string,
): T & JobContext {
  return { ...data, correlationId };
}
