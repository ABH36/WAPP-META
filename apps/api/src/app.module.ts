import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import configuration from "./config/configuration.js";
import { validateEnv } from "./config/env.validation.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { AppLoggingModule } from "./common/logging/logging.module.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";

/**
 * Root module — Modular Monolith composition root (SAD-001 Volume-1 §4).
 *
 * Domain modules (Identity, Workspace, Collaboration, Communication, CRM,
 * Billing, Settings, Platform) are added one at a time as each is built, per
 * the approved Module Development Order (SDP-001 §6) and the "one module
 * fully reviewed and approved before the next begins" rule. This module
 * wires the cross-cutting infrastructure every domain module depends on:
 * config, logging, database, external integrations (Redis/Queue/Email/
 * Storage), rate limiting, and the standard error/response envelope.
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
    // SEC-009 — general authenticated API default. Auth-endpoint-specific
    // stricter tiers (5/min) are applied via @Throttle() on individual routes
    // once the Identity module exists.
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 300,
      },
    ]),
    DatabaseModule,
    InfrastructureModule,
    HealthModule,
    IdentityModule,
    WorkspaceModule,
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
