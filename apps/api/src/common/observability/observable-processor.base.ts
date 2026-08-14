import { randomUUID } from "node:crypto";
import type { Logger } from "@nestjs/common";
import { WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import type { CorrelationContextService } from "./correlation-context.service.js";
import type { MetricsService } from "../metrics/metrics.service.js";
import type { JobContext } from "./job-context.util.js";

const tracer = trace.getTracer("wapp-api-queue");

/**
 * PHD-001 Volume-2 — shared base for every BullMQ processor, closing 3
 * approved Architecture Review findings in one place instead of 11 separate
 * hand-rolled copies:
 *  - §4.2 Correlation IDs: reads `job.data.correlationId` (set at enqueue
 *    time by `withCorrelationId()`) into the same `CorrelationContextService`
 *    HTTP requests use, so a log line from inside `handle()` shares the same
 *    ID as the request that triggered the job, when there was one.
 *  - §4.4 Distributed Tracing: BullMQ has no official OpenTelemetry
 *    auto-instrumentation package (confirmed during Architecture Review) —
 *    this is the manual span the Architect's approval named explicitly.
 *  - §4.12 Background Job Observability: execution-time histogram, retry
 *    counter, and a distinct "permanently failed" signal (as opposed to a
 *    same-shaped log line on every attempt, which is what existed before).
 *
 * Subclasses implement `handle()` instead of overriding `process()`.
 */
export abstract class ObservableProcessor<
  T extends Partial<JobContext> = JobContext,
> extends WorkerHost {
  protected abstract readonly queueName: string;
  protected abstract readonly logger: Logger;

  constructor(
    private readonly correlationContext: CorrelationContextService,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  protected abstract handle(job: Job<T>): Promise<void>;

  async process(job: Job<T>): Promise<void> {
    const correlationId = job.data.correlationId ?? randomUUID();
    await this.correlationContext.run(correlationId, () =>
      tracer.startActiveSpan(`queue.${this.queueName}`, (span) => this.runWithSpan(job, span)),
    );
  }

  private async runWithSpan(job: Job<T>, span: Span): Promise<void> {
    const start = process.hrtime.bigint();
    if (job.attemptsMade > 0) {
      this.metricsService.queueJobRetriesTotal.inc({ queue: this.queueName });
    }

    try {
      await this.handle(job);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      if (isFinalAttempt) {
        this.metricsService.queueJobFailedPermanentlyTotal.inc({ queue: this.queueName });
        this.logger.error(
          `Job ${job.id ?? "unknown"} on queue ${this.queueName} permanently failed after ${job.attemptsMade + 1} attempt(s): ${err.message}`,
        );
      }
      throw error;
    } finally {
      span.end();
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metricsService.queueJobDurationSeconds.observe(
        { queue: this.queueName },
        durationSeconds,
      );
    }
  }
}
