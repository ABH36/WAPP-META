import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EMAIL_QUEUE } from "./email.constants.js";
import { EmailService } from "./email.service.js";
import { EmailProcessor } from "./email.processor.js";

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
