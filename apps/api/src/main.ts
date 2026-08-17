// PHD-001 Volume-2 — must be the first import in the process (see tracing.ts's
// own doc comment for why): OpenTelemetry auto-instrumentation patches
// HTTP/Mongo(oose)/Redis at require-time, before anything else requires them.
import "./tracing.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { VersioningType } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import type { AppConfig } from "./config/configuration.js";
import { ErrorReportingService } from "./common/observability/error-reporting.service.js";

/**
 * PHD-001 Volume-3 §13 — `NestFactory.create()` is where Mongo's own
 * connection retry loop lives (`@nestjs/mongoose`'s default 9 attempts /
 * 3s apart, ~27s total before it throws). No Nest `Logger`/
 * `ErrorReportingService` exists yet at this point — DI hasn't finished
 * resolving — so a rejection here can't go through the same structured
 * path `uncaughtException`/`unhandledRejection` use further down. Without
 * this try/catch, that rejection fell through to Node's default
 * unhandled-rejection behavior (a raw stack trace on stderr, `void
 * bootstrap()` having already discarded the promise) instead of a clean,
 * intentional, non-zero exit.
 *
 * `abortOnError: false` is required for this catch block to ever run at
 * all — confirmed by reading `@nestjs/core`'s own source
 * (`nest-factory.js`/`exceptions-zone.js`). With the default
 * `abortOnError: true`, a DI-instantiation failure (e.g. Mongo connection
 * exhausting its retries) is caught internally by
 * `ExceptionsZone.asyncRun()`, logged via Nest's own `ExceptionHandler`,
 * and then terminated via `process.exit(1)` called directly from inside
 * that internal teardown — never as a rejected Promise returned to this
 * caller, so this try/catch was structurally unreachable for that failure
 * mode (confirmed via two Docker runtime tests against an unreachable
 * Mongo: PM2 logged the exit, but `bootstrap.failed` never appeared).
 * `abortOnError: false` makes Nest's internal teardown `rethrow` the error
 * instead, which propagates it as a genuine rejected Promise back to the
 * `await` below — Nest's own `[ExceptionHandler]` diagnostic log still
 * fires beforehand either way, so this is additive, not a replacement.
 *
 * The catch block below awaits `process.stderr.write(...)`'s callback
 * before calling `process.exit(1)`, rather than calling `console.error`
 * (fire-and-forget) followed immediately by `process.exit(1)`. This
 * matters specifically in Docker: stderr is a piped, non-TTY stream there,
 * which Node writes to asynchronously — `process.exit()` can terminate the
 * process before that write actually flushes, silently dropping the log
 * line. Confirmed by runtime testing: an intermediate version of this fix
 * (with `abortOnError: false` but still using fire-and-forget
 * `console.error`) still failed to reliably produce `bootstrap.failed` in
 * container logs.
 */
async function createApp() {
  try {
    return await NestFactory.create<NestExpressApplication>(AppModule, {
      abortOnError: false,
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
      // PHD-001 Volume-3 §26 — disables Nest's automatic default-limit
      // json/urlencoded parser registration so `bootstrap()` can register
      // its own with an explicit `limit`, via `app.useBodyParser(...)`
      // (which still threads `rawBody: true` through automatically — see
      // that call site's own comment).
      bodyParser: false,
    });
  } catch (error) {
    const line = JSON.stringify({
      level: "fatal",
      service: "wapp-api",
      event: "bootstrap.failed",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      time: new Date().toISOString(),
    });
    await new Promise<void>((resolve) => {
      process.stderr.write(`${line}\n`, () => resolve());
    });
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  const app = await createApp();

  // Centralized structured logging (Architecture Review engineering
  // improvement) — replaces Nest's default logger app-wide, including
  // framework-internal logs, not just application code.
  app.useLogger(app.get(Logger));

  // PHD-001 Volume-3 §12 — without this, `onApplicationShutdown` hooks never
  // fire on SIGTERM/SIGINT: Redis's `redis.quit()` (`RedisModule`),
  // `@nestjs/bullmq`'s own graceful Worker close (waits for the current
  // in-flight job per queue to finish before closing), and the OpenTelemetry
  // SDK flush (`TracingShutdownService`) would all be skipped on every
  // container stop. Nest handles the signal→`app.close()`→re-signal sequence
  // internally; no separate `process.on(...)` handler is needed here.
  app.enableShutdownHooks();

  // PHD-001 Volume-3 §17 — discovered during k6 load-test setup: with no
  // `trust proxy` setting, Express's `req.ip` (what SEC-010's
  // Redis-backed `ThrottlerGuard` keys the 300 req/60s limit on) resolves
  // to nginx's own internal Docker IP for every request in production
  // (docker-compose.prod.yml puts nginx in front of this API), not the
  // real client — collapsing the intended per-client rate limit into one
  // shared platform-wide limit. `1` trusts exactly the one reverse-proxy
  // hop that topology actually has, reading the real client IP from
  // `X-Forwarded-For` as nginx sets it; it does NOT trust an arbitrary
  // chain, so a direct caller (e.g. local dev, which runs with no proxy in
  // front at all) can't spoof its own IP by sending its own
  // `X-Forwarded-For` header.
  app.set("trust proxy", 1);

  // PHD-001 Volume-3 §26 — explicit, documented request-body-size cap.
  // Previously unset anywhere, silently falling back to `body-parser`'s own
  // undocumented 100kb default. 1mb comfortably covers every real JSON
  // payload this API receives (file uploads bypass the body parser
  // entirely via Cloudinary direct-upload signing, SEC-016) while still
  // bounding an unauthenticated-until-signature-verified endpoint like the
  // inbound WhatsApp webhook. `rawBody: true` (still threaded through
  // automatically by `app.useBodyParser`) is unaffected — see
  // `bodyParser: false` above.
  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });

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
