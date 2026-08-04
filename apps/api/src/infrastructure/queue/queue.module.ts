import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import type { AppConfig } from "../../config/configuration.js";

/**
 * Registers the shared BullMQ connection. Individual business modules register
 * their own named queues via `BullModule.registerQueue({ name: "..." })` in
 * their own module — this only owns the connection, not any specific queue,
 * consistent with TAD-001 §10 (approved workloads: Broadcast, Email, Media
 * processing, Scheduled reminders, Retry operations — each belongs to the
 * module that owns that business capability, not to Infrastructure).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: {
          // BullMQ wants connection options, not a shared ioredis instance, so
          // it can manage its own retry/reconnect behavior independently of
          // RedisModule's general-purpose client.
          url: config.get("redisUrl", { infer: true }),
          maxRetriesPerRequest: null,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
