import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import type { AppConfig } from "../config/configuration.js";

/**
 * MongoDB Atlas connection — SAD-002 §2. This is the only place a raw connection
 * string is used; every domain module imports MongooseModule.forFeature(...) for
 * its own collections (SAD-002 DB-001 — one module owns one collection), never a
 * second top-level connection.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const pool = config.get("mongoPool", { infer: true });
        return {
          uri: config.get("mongoUri", { infer: true }),
          // PHD-001 Volume-3 §7 — conservative, environment-driven starting
          // values; see configuration.ts's own doc comment for the
          // "unvalidated pending real production telemetry" caveat.
          maxPoolSize: pool.maxPoolSize,
          minPoolSize: pool.minPoolSize,
          connectTimeoutMS: pool.connectTimeoutMs,
          socketTimeoutMS: pool.socketTimeoutMs,
          serverSelectionTimeoutMS: pool.serverSelectionTimeoutMs,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
