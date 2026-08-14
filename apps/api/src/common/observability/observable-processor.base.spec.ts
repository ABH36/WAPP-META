import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { ObservableProcessor } from "./observable-processor.base.js";
import { CorrelationContextService } from "./correlation-context.service.js";
import { MetricsService } from "../metrics/metrics.service.js";
import type { JobContext } from "./job-context.util.js";

function fakeJob(overrides: Partial<Job<Partial<JobContext>>> = {}): Job<Partial<JobContext>> {
  return {
    id: "job-1",
    data: {},
    attemptsMade: 0,
    opts: {},
    ...overrides,
  } as unknown as Job<Partial<JobContext>>;
}

describe("ObservableProcessor", () => {
  let correlationContext: CorrelationContextService;
  let metricsService: MetricsService;
  let handle: jest.Mock;

  class TestProcessor extends ObservableProcessor<Partial<JobContext>> {
    protected readonly queueName = "test-queue";
    protected readonly logger = new Logger(TestProcessor.name);

    protected async handle(job: Job<Partial<JobContext>>): Promise<void> {
      await handle(job);
    }
  }

  beforeEach(() => {
    correlationContext = new CorrelationContextService();
    metricsService = new MetricsService();
    handle = jest.fn().mockResolvedValue(undefined);
  });

  it("delegates to handle() and observes the duration histogram on success", async () => {
    const processor = new TestProcessor(correlationContext, metricsService);
    const job = fakeJob();

    await processor.process(job);

    expect(handle).toHaveBeenCalledWith(job);
    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_queue_job_duration_seconds",
    );
    expect(metric).toContain('queue="test-queue"');
  });

  it("runs handle() inside the job's correlation context, generating one when absent", async () => {
    let seenId: string | undefined;
    handle.mockImplementation(() => {
      seenId = correlationContext.getCorrelationId();
      return Promise.resolve();
    });
    const processor = new TestProcessor(correlationContext, metricsService);

    await processor.process(fakeJob({ data: {} }));

    expect(seenId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses job.data.correlationId when present instead of generating a new one", async () => {
    let seenId: string | undefined;
    handle.mockImplementation(() => {
      seenId = correlationContext.getCorrelationId();
      return Promise.resolve();
    });
    const processor = new TestProcessor(correlationContext, metricsService);

    await processor.process(fakeJob({ data: { correlationId: "job-corr-id" } }));

    expect(seenId).toBe("job-corr-id");
  });

  it("increments the retry counter when attemptsMade > 0", async () => {
    const processor = new TestProcessor(correlationContext, metricsService);

    await processor.process(fakeJob({ attemptsMade: 1 }));

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_queue_job_retries_total",
    );
    expect(metric).toMatch(/wapp_queue_job_retries_total\{queue="test-queue"\} 1/);
  });

  it("does not increment the retry counter on the first attempt", async () => {
    const processor = new TestProcessor(correlationContext, metricsService);

    await processor.process(fakeJob({ attemptsMade: 0 }));

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_queue_job_retries_total",
    );
    expect(metric).not.toContain('queue="test-queue"');
  });

  it("rethrows the handler's error and increments permanently-failed on the final attempt", async () => {
    handle.mockRejectedValue(new Error("boom"));
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const processor = new TestProcessor(correlationContext, metricsService);

    await expect(
      processor.process(fakeJob({ attemptsMade: 2, opts: { attempts: 3 } })),
    ).rejects.toThrow("boom");

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_queue_job_failed_permanently_total",
    );
    expect(metric).toMatch(/wapp_queue_job_failed_permanently_total\{queue="test-queue"\} 1/);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("permanently failed"));

    errorSpy.mockRestore();
  });

  it("rethrows the handler's error without the permanent-failure metric when retries remain", async () => {
    handle.mockRejectedValue(new Error("transient failure"));
    const processor = new TestProcessor(correlationContext, metricsService);

    await expect(
      processor.process(fakeJob({ attemptsMade: 0, opts: { attempts: 3 } })),
    ).rejects.toThrow("transient failure");

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_queue_job_failed_permanently_total",
    );
    expect(metric).not.toContain('queue="test-queue"');
  });

  it("treats a missing opts.attempts as a single-attempt job (fails permanently immediately)", async () => {
    handle.mockRejectedValue(new Error("boom"));
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    const processor = new TestProcessor(correlationContext, metricsService);

    await expect(processor.process(fakeJob({ attemptsMade: 0, opts: {} }))).rejects.toThrow("boom");

    const metric = await metricsService.registry.getSingleMetricAsString(
      "wapp_queue_job_failed_permanently_total",
    );
    expect(metric).toMatch(/wapp_queue_job_failed_permanently_total\{queue="test-queue"\} 1/);
  });
});
