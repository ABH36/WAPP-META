import { NodeSDK, tracing } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

/**
 * PHD-001 Volume-2 (Observability, Monitoring & Logging) — must be the very
 * first thing this process imports (see `main.ts`), before `@nestjs/core`,
 * `mongoose`, or `ioredis` are ever `require`d anywhere in the module graph.
 * OpenTelemetry's auto-instrumentation works by monkey-patching each target
 * module's exports at `require`-time; if HTTP/Mongo/Redis are already loaded
 * before `sdk.start()` runs, the patch never applies and every span silently
 * never appears. This file has no dependency on `ConfigService` (Nest's DI
 * container doesn't exist yet at this point in the boot sequence) — reading
 * `process.env` directly here is the one deliberate exception to "never read
 * process.env outside configuration.ts."
 *
 * Provider-neutral, environment-driven (Architecture Review, PHD-001
 * Volume-2): `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_SERVICE_NAME` are
 * OpenTelemetry's own standard env vars — the SDK/exporter already read them
 * without any custom plumbing, so no vendor is picked here, and none of this
 * file needs to change when a real collector endpoint is configured.
 *
 * - No endpoint configured, non-production: traces render to the console —
 *   useful for local development, never silently inert.
 * - No endpoint configured, production: tracing stays fully inert (the SDK
 *   never starts, so auto-instrumentation never patches anything, zero
 *   runtime overhead) rather than flooding structured stdout logs with
 *   unparsed span dumps. Ops opts in by setting the endpoint.
 * - Endpoint configured (any environment): real OTLP export, whatever
 *   collector/backend is on the other end.
 */
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const isProduction = process.env.NODE_ENV === "production";

/**
 * PHD-001 Volume-3 §12 — a no-op by default (tracing may never have started,
 * e.g. production with no OTLP endpoint configured), overwritten below only
 * when the SDK actually starts. Deliberately NOT a `process.on("SIGTERM", ...)`
 * handler in this file anymore (that raced/bypassed Nest's own shutdown
 * sequence — see `common/observability/tracing-shutdown.service.ts`, which
 * calls this from a proper `OnApplicationShutdown` hook instead, so the SDK
 * flush happens in the same ordered sequence as every other resource's
 * shutdown, not a second, independent one).
 */
export let shutdownTracing: () => Promise<void> = async () => {};

if (otlpEndpoint || !isProduction) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "wapp-api",
      [ATTR_SERVICE_VERSION]: process.env.BUILD_VERSION ?? "unknown",
    }),
    traceExporter: otlpEndpoint ? new OTLPTraceExporter() : new tracing.ConsoleSpanExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Only the 4 targets PHD-001 Volume-2 §4.4 names auto-instrumentation
        // for: HTTP, the MongoDB driver (Mongoose sits on top of it — both
        // layers covered by the mongodb + mongoose instrumentations below),
        // and ioredis. Every other instrumentation in the meta-package
        // (fs/dns/net/generic-pool/etc.) is noise for this codebase and
        // disabled explicitly rather than left to the package's own
        // (broader) defaults.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-express": { enabled: true },
        "@opentelemetry/instrumentation-mongodb": { enabled: true },
        "@opentelemetry/instrumentation-mongoose": { enabled: true },
        "@opentelemetry/instrumentation-ioredis": { enabled: true },
      }),
    ],
  });

  sdk.start();

  // Flush any buffered spans before the process actually exits — invoked by
  // `TracingShutdownService.onApplicationShutdown()` as part of Nest's own
  // graceful-shutdown sequence (`app.enableShutdownHooks()` in main.ts),
  // not a competing signal handler of its own.
  shutdownTracing = () => sdk.shutdown();
}
