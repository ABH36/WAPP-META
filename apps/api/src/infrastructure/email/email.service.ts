import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { CorrelationContextService } from "../../common/observability/correlation-context.service.js";
import { withCorrelationId } from "../../common/observability/job-context.util.js";
import { EMAIL_QUEUE } from "./email.constants.js";
import type { SendEmailJob } from "./email.types.js";

/**
 * The only interface business modules use to send email. Always queues —
 * never sends synchronously in the request/response cycle (TAD-001 v1.2 Email
 * Patch: "registration should not block on Resend's API responding").
 */
@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<SendEmailJob>,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  async send(job: Omit<SendEmailJob, "correlationId">): Promise<void> {
    const data = withCorrelationId(job, this.correlationContext.getOrCreateCorrelationId());
    await this.queue.add("send-email", data, {
      // Retry strategy per TAD-001 v1.2 Email Patch: 3 attempts, exponential
      // backoff (10s / 60s / 5min).
      attempts: 3,
      backoff: {
        type: "custom",
      },
    });
  }
}
