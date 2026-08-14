import { AsyncLocalStorage } from "node:async_hooks";

/**
 * PHD-001 Volume-2 — the actual store behind `CorrelationContextService`,
 * exported as a plain module-level singleton (not resolved through Nest's
 * DI container) specifically so `logging.module.ts`'s `pinoHttp.mixin` hook
 * can read it directly. `mixin` runs synchronously on every single Pino log
 * call, including ones made deep in the service layer via `new Logger(...)`
 * — Pino has no notion of Nest's DI container at that point, only whatever
 * ambient (AsyncLocalStorage) context is active, which is exactly what this
 * provides. `CorrelationContextService` (the injectable most call sites
 * actually use) wraps this same singleton rather than owning a second,
 * disconnected one.
 */
export interface RequestContextStore {
  correlationId: string;
  userId?: string;
  workspaceId?: string;
  platformUserId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();
