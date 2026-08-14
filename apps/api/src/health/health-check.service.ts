import { Inject, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { ConnectionStates, type Connection } from "mongoose";
import type Redis from "ioredis";
import type { AppConfig } from "../config/configuration.js";
import { REDIS_CLIENT } from "../infrastructure/redis/redis.constants.js";
import { MetricsService } from "../common/metrics/metrics.service.js";

export interface HealthChecks {
  database: boolean;
  redis: boolean;
  queue: boolean;
  storage: boolean;
  email: boolean;
}

export interface CacheStatus {
  connected: boolean;
  usedMemoryBytes: number | null;
}

/**
 * Shared between the public `/health` endpoint (Database only, for
 * infra/container probes) and Settings' authenticated `/settings/
 * diagnostics` (PRD-006 Volume-4 §4.7, the fuller check set) — one
 * implementation, two consumers, per the Architecture Review's "extend
 * through composition, not a parallel monitoring implementation"
 * resolution. Storage/Email are configuration-presence checks, not live
 * network pings — a live Cloudinary/Resend call on every health check
 * would be slow and itself a new failure mode; Queue reuses the Redis
 * check since every BullMQ queue in this codebase rides the same Redis
 * instance (`infrastructure/queue/queue.module.ts`) — a reachable Redis is
 * the meaningful signal today. See docs/ADR-SET-007-audit-strategy.md.
 */
@Injectable()
export class HealthCheckService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly metricsService: MetricsService,
  ) {}

  checkDatabase(): boolean {
    const connected = this.mongoConnection.readyState === ConnectionStates.connected;
    this.metricsService.infraDependencyUp.set({ dependency: "mongodb" }, connected ? 1 : 0);
    return connected;
  }

  async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      const connected = pong === "PONG";
      this.metricsService.infraDependencyUp.set({ dependency: "redis" }, connected ? 1 : 0);
      return connected;
    } catch {
      this.metricsService.infraDependencyUp.set({ dependency: "redis" }, 0);
      return false;
    }
  }

  checkStorage(): boolean {
    const cloudinary = this.config.get("cloudinary", { infer: true });
    return Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret);
  }

  checkEmail(): boolean {
    const resend = this.config.get("resend", { infer: true });
    return Boolean(resend.apiKey && resend.fromAddress);
  }

  /** §4.14 Diagnostics extension — memory usage alongside the plain up/down `redis` check. */
  async getCacheStatus(): Promise<CacheStatus> {
    try {
      const info = await this.redis.info("memory");
      const match = /used_memory:(\d+)/.exec(info);
      return { connected: true, usedMemoryBytes: match ? Number(match[1]) : null };
    } catch {
      return { connected: false, usedMemoryBytes: null };
    }
  }

  async getChecks(): Promise<HealthChecks> {
    const [database, redis] = [this.checkDatabase(), await this.checkRedis()];
    return {
      database,
      redis,
      queue: redis,
      storage: this.checkStorage(),
      email: this.checkEmail(),
    };
  }
}
