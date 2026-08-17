import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EMAIL_QUEUE } from "./email.constants.js";
import { EmailService } from "./email.service.js";
import { EmailProcessor } from "./email.processor.js";

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      // PHD-001 Volume-3 §8/§9 — no queue previously capped completed/failed
      // job retention, an unbounded Redis-memory-growth risk at volume.
      // Count-based, not time-based: keeps a bounded, useful recent history
      // for debugging without needing a second sweep job. Unvalidated
      // starting values pending §27 load-test results.
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
