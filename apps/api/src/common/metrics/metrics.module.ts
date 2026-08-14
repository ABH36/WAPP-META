import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MetricsService } from "./metrics.service.js";
import { MetricsController } from "./metrics.controller.js";
import { MetricsAuthGuard } from "./metrics-auth.guard.js";
import { HttpMetricsInterceptor } from "./http-metrics.interceptor.js";

/**
 * PHD-001 Volume-2 — `@Global()` so `MetricsService` is injectable from any
 * business module (Auth/Communication/CRM/Billing/Settings/Platform all
 * record their own domain counters) without each one importing this module
 * explicitly, matching the existing `SecurityModule`'s `@Global()` pattern.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsAuthGuard,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
