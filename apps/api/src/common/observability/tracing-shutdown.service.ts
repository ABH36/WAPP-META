import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { shutdownTracing } from "../../tracing.js";

/**
 * PHD-001 Volume-3 §12 — flushes the OpenTelemetry SDK as part of Nest's own
 * `onApplicationShutdown` sequence (triggered by `app.enableShutdownHooks()`
 * in `main.ts`), alongside `RedisModule`'s `redis.quit()`, Mongoose's own
 * connection close, `QueueStatusService`'s monitoring-queue close, and
 * `@nestjs/bullmq`'s own `onApplicationShutdown` (closes every registered
 * Worker, waiting for its current in-flight job to finish). Previously
 * `tracing.ts` registered its own independent `process.on("SIGTERM", ...)`
 * handler that called `process.exit(0)` directly — bypassing `app.close()`
 * entirely, so none of those other hooks were guaranteed to run at all.
 */
@Injectable()
export class TracingShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTracing();
  }
}
