import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { AppConfig } from "../../config/configuration.js";
import { REDIS_CLIENT } from "./redis.constants.js";

/**
 * Single Redis connection for the whole application (cache, rate-limit state,
 * and the base connection BullMQ's queues reuse — SAD-002 §2 / TAD-001 §9).
 * `@Global()` because Redis is genuinely cross-cutting infrastructure — every
 * future business module that needs caching or queueing gets it via DI without
 * each one re-declaring a Redis connection.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): Redis => {
        return new Redis(config.get("redisUrl", { infer: true }), {
          // Required by BullMQ when this client is reused as its connection.
          maxRetriesPerRequest: null,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // NestJS only auto-closes connections it manages natively (e.g. Mongoose).
  // A manually-provided ioredis client needs an explicit shutdown hook or the
  // connection leaks on app termination.
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
