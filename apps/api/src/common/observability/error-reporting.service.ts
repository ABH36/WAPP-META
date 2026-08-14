import { Injectable, Logger } from "@nestjs/common";

export interface ErrorReportContext {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  platformUserId?: string;
  [key: string]: unknown;
}

/**
 * PHD-001 Volume-2 §4.5 — "Support external providers... Provider selection
 * remains environment-driven," read alongside §5's exclusion of any actual
 * vendor deployment (Sentry/Datadog/etc.): the correct scope for this volume
 * is the abstraction/hook point, not an installed vendor SDK. Every call
 * site in this codebase (`HttpExceptionFilter`, `main.ts`'s process-level
 * handlers) depends on this abstract class, never a concrete provider — a
 * real integration later is a single new `ErrorReportingService`
 * implementation swapped in via `ObservabilityModule`'s provider factory,
 * with zero changes anywhere else.
 */
export abstract class ErrorReportingService {
  abstract captureException(error: unknown, context?: ErrorReportContext): void;
}

/**
 * The only implementation that exists today. A genuine no-op, not a second
 * logger — every real call site (`HttpExceptionFilter`, `main.ts`'s
 * process-level handlers) already logs the same exception via its own
 * `Logger` before/alongside calling this, so having this log too would just
 * duplicate every unexpected-error line at ERROR severity. `debug`-level
 * only, purely so it's visible during local development that this call
 * site is wired and reachable, without adding noise to production logs
 * (which run at `info` — see `logging.module.ts`).
 */
@Injectable()
export class NoopErrorReportingService extends ErrorReportingService {
  private readonly logger = new Logger(NoopErrorReportingService.name);

  captureException(error: unknown, context?: ErrorReportContext): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.debug(`[error-reporting: no provider configured] ${message}`, context);
  }
}
