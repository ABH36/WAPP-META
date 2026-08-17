import { Injectable, Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { AppConfig } from "../../config/configuration.js";
import { ObservableProcessor } from "../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../common/metrics/metrics.service.js";
import { EMAIL_QUEUE } from "./email.constants.js";
import type { SendEmailJob } from "./email.types.js";

/**
 * Retry schedule per TAD-001 v1.2 Email Patch: 10s / 60s / 5min — not a plain
 * doubling curve, so it's expressed as an explicit custom backoff rather than
 * BullMQ's built-in "exponential" type.
 */
const RETRY_DELAYS_MS = [10_000, 60_000, 300_000];

@Injectable()
@Processor(EMAIL_QUEUE, {
  // PHD-001 Volume-3 §9 — I/O-bound (Resend API calls), high volume, safe to
  // parallelize. Unvalidated starting value pending §27 load-test results.
  concurrency: 5,
  settings: {
    backoffStrategy: (attemptsMade: number): number => {
      return RETRY_DELAYS_MS[attemptsMade - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
    },
  },
})
export class EmailProcessor extends ObservableProcessor<SendEmailJob> {
  protected readonly logger = new Logger(EmailProcessor.name);
  protected readonly queueName = EMAIL_QUEUE;
  private readonly resend: Resend;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
    this.resend = new Resend(this.config.get("resend", { infer: true }).apiKey);
  }

  protected async handle(job: Job<SendEmailJob>): Promise<void> {
    const { to, subject, html, text, category } = job.data;
    const resendConfig = this.config.get("resend", { infer: true });

    // Development: never hits Resend at all, just logs — fast local iteration,
    // zero risk of accidental delivery.
    if (this.config.get("env", { infer: true }) === "development" && resendConfig.testMode) {
      this.logger.log(`[EMAIL:${category}] would send to ${to} — "${subject}"`);
      return;
    }

    // Staging: real delivery, but only to an explicit allow-list — prevents
    // accidental delivery to real customer addresses during QA (TAD-001 v1.2
    // Email Patch, Development vs. Production Behavior table).
    if (resendConfig.testMode && !resendConfig.testRecipientAllowlist.includes(to)) {
      this.logger.warn(
        `[EMAIL:${category}] blocked — recipient ${to} not in EMAIL_TEST_RECIPIENT_ALLOWLIST`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: `${resendConfig.fromName} <${resendConfig.fromAddress}>`,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      // Thrown, not swallowed — BullMQ's retry/backoff (registered above) and
      // the dead-letter handling after 3 attempts depend on this rejecting.
      throw new Error(`Resend send failed for category "${category}": ${error.message}`);
    }
  }
}
