import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard, ThrottlerStorage } from "@nestjs/throttler";
import { RedisThrottlerStorageService } from "./infrastructure/redis/redis-throttler-storage.service.js";
import configuration from "./config/configuration.js";
import { validateEnv } from "./config/env.validation.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { AppLoggingModule } from "./common/logging/logging.module.js";
import { EventsModule } from "./common/events/events.module.js";
import { SecurityModule } from "./common/security/security.module.js";
import { MetricsModule } from "./common/metrics/metrics.module.js";
import { ObservabilityModule } from "./common/observability/observability.module.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";
import { CommunicationModule } from "./modules/communication/communication.module.js";
import { CrmModule } from "./modules/crm/crm.module.js";
import { BillingModule } from "./modules/billing/billing.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { PlatformModule } from "./modules/platform/platform.module.js";

/**
 * Root module — Modular Monolith composition root (SAD-001 Volume-1 §4).
 *
 * Domain modules (Identity, Workspace, Communication, CRM, Billing,
 * Settings, Platform Administration) are added one at a time as each is
 * built, per the approved Module Development Order and the "one module
 * fully reviewed and approved before the next begins" rule. This module
 * wires the cross-cutting infrastructure every domain module depends on:
 * config, logging, database, external integrations (Redis/Queue/Email/
 * Storage), rate limiting, and the standard error/response envelope.
 *
 * "Collaboration" is deliberately absent from this list (Architecture
 * Review, 2026-08-04) — it isn't a standalone module. Internal Notes,
 * @mentions, and shared-team-collaboration capabilities are owned by
 * whichever business module holds the underlying data (Communication,
 * CRM), the same pattern as EventsModule above: reusable components,
 * business ownership stays in the originating module, no separate
 * Collaboration service.
 *
 * Identity (Phase-2) is the first domain module — it also registers the
 * global JwtAuthGuard/PermissionsGuard (see IdentityModule), so every route
 * added by a future domain module is authenticated by default from the
 * moment it's declared.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: [".env"],
    }),
    AppLoggingModule,
    EventsModule,
    SecurityModule,
    ObservabilityModule,
    MetricsModule,
    // SEC-009 — general authenticated API default. Auth-endpoint-specific
    // stricter tiers (5/min) are applied via @Throttle() on individual routes
    // once the Identity module exists.
    //
    // PHD-001 Volume-3 §8/§22/BR-008 — Redis-backed storage (see
    // RedisThrottlerStorageService's own doc comment), not the library's
    // in-memory default, so rate-limit state is shared across every API
    // instance instead of being enforced independently per process.
    // `forRootAsync` with the object-form options (`{throttlers, storage}`)
    // is required to pass a custom storage at all — the array-of-throttlers
    // shorthand form (`forRoot([{...}])`) ignores `storage` unconditionally.
    ThrottlerModule.forRootAsync({
      inject: [RedisThrottlerStorageService],
      useFactory: (storage: ThrottlerStorage) => ({
        throttlers: [
          {
            name: "default",
            ttl: 60_000,
            limit: 300,
          },
        ],
        storage,
      }),
    }),
    DatabaseModule,
    InfrastructureModule,
    HealthModule,
    IdentityModule,
    WorkspaceModule,
    CommunicationModule,
    CrmModule,
    BillingModule,
    SettingsModule,
    PlatformModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // API-005 — every incoming request validated via DTOs before reaching
    // services. An APP_PIPE provider (not an imperative main.ts call) so it's
    // active identically under Nest's TestingModule (e2e tests) and the real
    // bootstrap — a pipe only wired in main.ts would silently not run in tests.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // strips unknown properties — first line of output sanitization
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
