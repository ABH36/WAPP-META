import { RedisThrottlerStorageService } from "./redis-throttler-storage.service.js";

describe("RedisThrottlerStorageService", () => {
  let evalMock: jest.Mock;
  let redis: { eval: jest.Mock };
  let service: RedisThrottlerStorageService;

  beforeEach(() => {
    evalMock = jest.fn();
    redis = { eval: evalMock };
    service = new RedisThrottlerStorageService(redis as never);
  });

  it("namespaces the Redis key by throttlerName and passes ttl/limit/blockDuration/now as script args", async () => {
    evalMock.mockResolvedValue([1, 60, 0, 0]);

    await service.increment("1.2.3.4", 60_000, 300, 60_000, "default");

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "throttler:default:1.2.3.4",
      60_000,
      300,
      60_000,
      expect.any(Number),
    );
  });

  it("maps the script's [hits, timeToExpire, isBlocked, timeToBlockExpire] tuple to a ThrottlerStorageRecord", async () => {
    evalMock.mockResolvedValue([5, 42, 0, 0]);

    const result = await service.increment("key", 60_000, 300, 60_000, "default");

    expect(result).toEqual({
      totalHits: 5,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it("maps isBlocked=1 to a real boolean true", async () => {
    evalMock.mockResolvedValue([301, 60, 1, 60]);

    const result = await service.increment("key", 60_000, 300, 60_000, "default");

    expect(result).toEqual({
      totalHits: 301,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it("uses a separate Redis key per throttler name for the same underlying tracker", async () => {
    evalMock.mockResolvedValue([1, 60, 0, 0]);

    await service.increment("1.2.3.4", 60_000, 5, 60_000, "auth");

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "throttler:auth:1.2.3.4",
      60_000,
      5,
      60_000,
      expect.any(Number),
    );
  });
});
