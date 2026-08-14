import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { AppConfig } from "../../config/configuration.js";
import { requestContextStorage } from "../observability/request-context.storage.js";

const REQUEST_ID_HEADER = "x-request-id";
const TRACE_ID_HEADER = "x-trace-id";

/**
 * Centralized structured logging — Architecture Review engineering improvement.
 * Every log line carries a request ID, and a correlation/trace ID is
 * propagated from the caller if provided (or generated) so a request can be
 * followed across services once the platform has more than one. JSON in
 * production, human-readable in development. Sensitive fields are redacted
 * structurally (TAD-001 LOG-002), not left to per-call developer discipline.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const isProduction = config.get("env", { infer: true }) === "production";

        return {
          pinoHttp: {
            level: isProduction ? "info" : "debug",
            transport: isProduction
              ? undefined
              : { target: "pino-pretty", options: { singleLine: true, colorize: true } },
            genReqId: (req: IncomingMessage, res: ServerResponse): string => {
              const existing = req.headers[REQUEST_ID_HEADER];
              const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
              res.setHeader(REQUEST_ID_HEADER, id);
              return id;
            },
            // `x-trace-id` only — `x-correlation-id` is covered universally
            // by `mixin` below (reading the same value back out of
            // `requestContextStorage`, which `CorrelationMiddleware` seeds
            // from this exact header), so setting it here too would be a
            // redundant, easy-to-drift-out-of-sync duplicate.
            customProps: (req: IncomingMessage) => ({
              traceId: req.headers[TRACE_ID_HEADER] ?? undefined,
            }),
            // PHD-001 Volume-2 §4.1 — unlike `customProps` above (which only
            // merges into pino-http's own auto-logged HTTP access-log line),
            // `mixin` runs on *every* Pino log call, including plain
            // `new Logger(ClassName.name)` calls made deep in the service
            // layer — the only way "every log entry" (not just the HTTP
            // summary line) actually carries correlation/user/workspace/
            // platform-user context. Reads `requestContextStorage` directly
            // (the same AsyncLocalStorage `CorrelationContextService`/
            // `RequestContextInterceptor` write into) rather than through
            // Nest's DI container, which `mixin` has no access to. "Service
            // name" is the static `service` field below; "Module name" is
            // already Nest's own per-class `context` field on every log
            // line (from `new Logger(ClassName.name)`), not duplicated here.
            mixin: () => {
              const store = requestContextStorage.getStore();
              return {
                service: "wapp-api",
                correlationId: store?.correlationId,
                userId: store?.userId,
                workspaceId: store?.workspaceId,
                platformUserId: store?.platformUserId,
              };
            },
            // TAD-001 LOG-002 — sensitive fields are never logged, enforced
            // structurally rather than by convention at each call site.
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                // PHD-001 Volume-1 — the httpOnly refresh-token cookie now
                // travels in the response's Set-Cookie header; redact it
                // symmetrically with the request-side cookie above.
                'res.headers["set-cookie"]',
                "req.body.password",
                "req.body.currentPassword",
                "req.body.newPassword",
                "req.body.token",
                "req.body.refreshToken",
                "req.body.otp",
                "*.password",
                "*.accessToken",
                "*.refreshToken",
                "*.jwt",
                "*.secret",
                "*.apiKey",
                "*.apiSecret",
              ],
              censor: "[REDACTED]",
            },
            autoLogging: true,
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggingModule {}
