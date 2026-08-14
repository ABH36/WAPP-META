import pino from "pino";

/**
 * PHD-001 Volume-2 §4.1/Architecture Review (2026-08-13) — brings this app's
 * server-side logging up to the same Pino/structured standard as apps/api
 * (common/logging/logging.module.ts): JSON in production, pretty in
 * development, sensitive fields redacted structurally. Node-runtime only —
 * never imported from `middleware.ts` or any other Edge-runtime code path,
 * since Pino's core relies on Node built-ins the Edge runtime doesn't have.
 */
export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { singleLine: true, colorize: true } },
  base: { service: "wapp-web" },
  redact: {
    paths: [
      "*.password",
      "*.currentPassword",
      "*.newPassword",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.otp",
      "*.secret",
      "*.apiKey",
      "*.apiSecret",
    ],
    censor: "[REDACTED]",
  },
});
