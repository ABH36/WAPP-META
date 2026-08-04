import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module.js";
import type { AppConfig } from "./config/configuration.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until the Pino logger (registered via AppLoggingModule) takes
    // over below — nothing logs through Nest's default console logger.
    bufferLogs: true,
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

  // API-005 — every incoming request validated via DTOs before reaching services.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown properties — first line of output sanitization
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // API-003 — URI versioning (/api/v1/...). Health check opts out via
  // VERSION_NEUTRAL (see HealthController) since infra probes need one stable path.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.setGlobalPrefix("api");

  const port = config.get("port", { infer: true });
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`WAPP API listening on port ${port} [${config.get("env", { infer: true })}]`);
}

void bootstrap();
