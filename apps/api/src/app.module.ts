import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
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

/**
 * Root module — Modular Monolith composition root (SAD-001 Volume-1 §4).
 *
 * Domain modules (Identity, Workspace, Collaboration, Communication, CRM,
 * Billing, Settings, Platform) are added one at a time as each is built, per
 * the approved Module Development Order (SDP-001 §6) and the "one module
 * fully reviewed and approved before the next begins" rule — they are
 * intentionally NOT scaffolded here yet. This module wires the cross-cutting
 * infrastructure every domain module will depend on: config, logging,
 * database, external integrations (Redis/Queue/Email/Storage), rate limiting,
 * and the standard error/response envelope.
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
