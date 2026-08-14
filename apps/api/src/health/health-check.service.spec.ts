import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { ConnectionStates } from "mongoose";
import { HealthCheckService } from "./health-check.service.js";
import { REDIS_CLIENT } from "../infrastructure/redis/redis.constants.js";
import { MetricsService } from "../common/metrics/metrics.service.js";

describe("HealthCheckService", () => {
  let service: HealthCheckService;
  let mongoConnection: { readyState: ConnectionStates };
  let redis: { ping: jest.Mock; info: jest.Mock };
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mongoConnection = { readyState: ConnectionStates.connected };
    redis = { ping: jest.fn(), info: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthCheckService,
        { provide: getConnectionToken(), useValue: mongoConnection },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "cloudinary") {
                return { cloudName: "cloud", apiKey: "key", apiSecret: "secret" };
              }
              if (key === "resend") {
                return { apiKey: "key", fromAddress: "noreply@example.com" };
              }
              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(HealthCheckService);
    config = moduleRef.get(ConfigService);
  });

  it("checkDatabase reflects the Mongoose connection state", () => {
    expect(service.checkDatabase()).toBe(true);
    mongoConnection.readyState = ConnectionStates.disconnected;
    expect(service.checkDatabase()).toBe(false);
  });

  it("checkRedis returns true on PONG and false on any error", async () => {
    redis.ping.mockResolvedValue("PONG");
    await expect(service.checkRedis()).resolves.toBe(true);

    redis.ping.mockRejectedValue(new Error("connection refused"));
    await expect(service.checkRedis()).resolves.toBe(false);
  });

  it("checkStorage/checkEmail reflect config presence, not a live network call", () => {
    expect(service.checkStorage()).toBe(true);
    expect(service.checkEmail()).toBe(true);
    expect(config.get).not.toHaveBeenCalledWith(expect.stringMatching(/http|network/));
  });

  it("getChecks composes every check, reusing the Redis result for Queue", async () => {
    redis.ping.mockResolvedValue("PONG");
    const result = await service.getChecks();
    expect(result).toEqual({
      database: true,
      redis: true,
      queue: true,
      storage: true,
      email: true,
    });
  });

  it("getCacheStatus parses used_memory out of Redis INFO memory when reachable", async () => {
    redis.info.mockResolvedValue("# Memory\r\nused_memory:1048576\r\nused_memory_human:1.00M\r\n");

    await expect(service.getCacheStatus()).resolves.toEqual({
      connected: true,
      usedMemoryBytes: 1048576,
    });
  });

  it("getCacheStatus reports disconnected when Redis INFO fails", async () => {
    redis.info.mockRejectedValue(new Error("connection refused"));

    await expect(service.getCacheStatus()).resolves.toEqual({
      connected: false,
      usedMemoryBytes: null,
    });
  });
});
