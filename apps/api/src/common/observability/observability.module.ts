import { Global, MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CorrelationContextService } from "./correlation-context.service.js";
import { CorrelationMiddleware } from "./correlation.middleware.js";
import { RequestContextInterceptor } from "./request-context.interceptor.js";
import { ErrorReportingService, NoopErrorReportingService } from "./error-reporting.service.js";

/**
 * PHD-001 Volume-2 — `@Global()` so `CorrelationContextService`/
 * `ErrorReportingService` are injectable from any module (every BullMQ
 * enqueue call site, every `ObservableProcessor` subclass, the global
 * exception filter) without importing this module explicitly, matching
 * `SecurityModule`/`MetricsModule`'s existing `@Global()` pattern.
 */
@Global()
@Module({
  providers: [
    CorrelationContextService,
    CorrelationMiddleware,
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    // No real provider exists yet (§5 excludes deploying one this volume) —
    // this is the single place a future Sentry/Datadog/etc. implementation
    // gets swapped in, env-driven, with zero changes at any call site.
    { provide: ErrorReportingService, useClass: NoopErrorReportingService },
  ],
  exports: [CorrelationContextService, ErrorReportingService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}
