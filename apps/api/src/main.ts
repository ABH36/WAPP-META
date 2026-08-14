// PHD-001 Volume-2 — must be the first import in the process (see tracing.ts's
// own doc comment for why): OpenTelemetry auto-instrumentation patches
// HTTP/Mongo(oose)/Redis at require-time, before anything else requires them.
import "./tracing.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { VersioningType } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import type { AppConfig } from "./config/configuration.js";
import { ErrorReportingService } from "./common/observability/error-reporting.service.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until the Pino logger (registered via AppLoggingModule) takes
    // over below — nothing logs through Nest's default console logger.
    bufferLogs: true,
    // Preserves the exact raw request bytes on `request.rawBody` alongside
    // normal JSON parsing (PRD-003 Part 1) — Meta's webhook signature
    // (X-Hub-Signature-256) is computed over the raw payload bytes; verifying
    // against a re-serialized JSON object can mismatch on key order/
    // whitespace. Must be passed identically to `createNestApplication()` in
    // every e2e test too (same "silently doesn't apply in tests" class of
    // bug as the ValidationPipe fix above) — not just here.
    rawBody: true,
  });

  // Centralized structured logging (Architecture Review engineering
  // improvement) — replaces Nest's default logger app-wide, including
  // framework-internal logs, not just application code.
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);

  // SEC-008 — Helmet, applied globally, not opt-in per route.
  app.use(
    helmet({
      contentSecurityPolicy: {
        // SEC-013 — see TAD-001 v1.2 PATCH (Security Standards) for the full
        // directive rationale, including the documented 'unsafe-inline' style-src
        // exception required by Tailwind's dev-mode runtime injection.
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
          connectSrc: ["'self'", "https://graph.facebook.com"],
          frameAncestors: ["'none'"], // SEC-011 — modern-browser clickjacking protection
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true }, // SEC-008
      // SEC-011 explicitly mandates DENY, not Helmet's SAMEORIGIN default —
      // caught by inspecting the actual response headers, not by reading the
      // config. frame-ancestors 'none' above covers modern browsers;
      // X-Frame-Options: DENY is the same rule for browsers that predate CSP2.
      frameguard: { action: "deny" },
    }),
  );

  // SEC-010 — CORS explicitly allow-listed per environment, never wildcarded.
  app.enableCors({
    origin: config.get("corsAllowedOrigins", { infer: true }),
    credentials: true,
  });

  // SEC-016 — request size limit (file uploads bypass this via Cloudinary
  // direct-upload, per TAD-001 v1.2 PATCH rationale).
  app.use(compression());

  // PHD-001 Volume-1 — Express does not populate `request.cookies` on its own;
  // required for the auth controllers to read the httpOnly refresh-token cookie.
  app.use(cookieParser());

  // API-005 — every incoming request validated via DTOs before reaching
  // services. Registered as an APP_PIPE provider in AppModule (not here) so
  // it's active identically whether the app is bootstrapped via main.ts or
  // via Nest's TestingModule (e2e tests import AppModule directly and never
  // run this function) — a pipe registered only here would silently not run
  // in tests, letting invalid input reach the service layer unvalidated.

  // API-003 — URI versioning (/api/v1/...). Health check opts out via
  // VERSION_NEUTRAL (see HealthController) since infra probes need one stable path.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.setGlobalPrefix("api");

  // PHD-001 Volume-2 — a genuinely uncaught exception or unawaited rejected
  // promise means the process is in an undefined state; the correct
  // response is to log with full detail, hand off to the error-reporting
  // abstraction, and exit non-zero so the process manager (PM2, per
  // docker/api.Dockerfile) restarts a clean instance — not to silently keep
  // serving requests from a process that may have partially-corrupted state.
  const logger = app.get(Logger);
  const errorReporting = app.get(ErrorReportingService);

  process.on("uncaughtException", (error: Error) => {
    logger.error(`Uncaught exception — exiting: ${error.stack ?? error.message}`);
    errorReporting.captureException(error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`Unhandled promise rejection — exiting: ${error.stack ?? error.message}`);
    errorReporting.captureException(error);
    process.exit(1);
  });

  const port = config.get("port", { infer: true });
  await app.listen(port);

  logger.log(`WAPP API listening on port ${port} [${config.get("env", { infer: true })}]`);
}

void bootstrap();
