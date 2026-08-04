import { Module } from "@nestjs/common";
import { RedisModule } from "./redis/redis.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { EmailModule } from "./email/email.module.js";
import { StorageModule } from "./storage/storage.module.js";

/**
 * Home for every external-integration concern (Redis, BullMQ, Email, Storage,
 * and future integrations — Meta Cloud API client, SMS, etc.) — per the
 * Architecture Review engineering improvement: infrastructure code stays out
 * of business modules. AppModule imports this once; business modules import
 * only the specific sub-piece they need (e.g. Communication imports
 * EmailModule for notifications, not RedisModule directly).
 */
@Module({
  imports: [RedisModule, QueueModule, EmailModule, StorageModule],
  exports: [RedisModule, QueueModule, EmailModule, StorageModule],
})
export class InfrastructureModule {}
