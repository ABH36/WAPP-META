import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { AppConfig } from "../../config/configuration.js";

const CORRELATION_HEADER = "x-correlation-id";
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
            customProps: (req: IncomingMessage) => ({
              correlationId: req.headers[CORRELATION_HEADER] ?? undefined,
              traceId: req.headers[TRACE_ID_HEADER] ?? undefined,
            }),
            // TAD-001 LOG-002 — sensitive fields are never logged, enforced
            // structurally rather than by convention at each call site.
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
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
