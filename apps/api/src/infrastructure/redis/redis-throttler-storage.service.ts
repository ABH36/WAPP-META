import { Inject, Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants.js";

// Not re-exported from "@nestjs/throttler"'s public index (only the
// ThrottlerStorage interface is) — same shape as the package's own
// throttler-storage-record.interface.ts.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * PHD-001 Volume-3 §8/§22/BR-008 — `ThrottlerModule` previously used
 * `@nestjs/throttler`'s default in-memory storage: a per-process `Map`, so
 * each API instance would enforce its own independent counter, and the
 * *effective* fleet-wide limit would become `limit × instanceCount` once
 * `apps/api` scales to more than one instance — a direct correctness
 * difference between running one instance and many, which BR-008
 * explicitly forbids. Redis is already in the stack (used by BullMQ); this
 * reuses the same shared `REDIS_CLIENT` connection to make rate-limit
 * state authoritative across every instance.
 *
 * Deliberately a fixed-window counter (reset the count once its window
 * elapses) rather than a byte-for-byte reproduction of the in-memory
 * implementation's per-hit sliding expiry timers — both correctly enforce
 * "at most N requests per window, then blocked for `blockDuration`"; fixed-
 * window is the simpler, standard, easier-to-verify-atomic algorithm, and
 * the guarantee callers actually depend on (a cap is enforced, values are
 * never allowed to exceed `limit` for long) holds either way. Atomicity
 * across concurrent requests/processes is via a single Lua script (`EVAL`),
 * not a check-then-act read/write pair.
 */
@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttler:${throttlerName}:${key}`;
    const now = Date.now();

    const result = (await this.redis.eval(
      INCREMENT_SCRIPT,
      1,
      redisKey,
      ttl,
      limit,
      blockDuration,
      now,
    )) as [number, number, number, number];

    const [totalHits, timeToExpire, isBlockedFlag, timeToBlockExpire] = result;
    return {
      totalHits,
      timeToExpire,
      isBlocked: isBlockedFlag === 1,
      timeToBlockExpire,
    };
  }
}

/**
 * KEYS[1] = redis key
 * ARGV[1] = ttl (ms, count-window length)
 * ARGV[2] = limit
 * ARGV[3] = blockDuration (ms)
 * ARGV[4] = now (ms, unix epoch)
 *
 * Returns [totalHits, timeToExpire (s), isBlocked (0|1), timeToBlockExpire (s)].
 */
const INCREMENT_SCRIPT = `
local key = KEYS[1]
local ttl_ms = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block_duration_ms = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local hits = tonumber(redis.call("HGET", key, "hits") or "0")
local block_expires_at = tonumber(redis.call("HGET", key, "blockExpiresAt") or "0")
local expires_at = tonumber(redis.call("HGET", key, "expiresAt") or "0")

local is_blocked = block_expires_at > now

if not is_blocked then
  if expires_at <= now then
    hits = 0
    expires_at = now + ttl_ms
  end
  hits = hits + 1
  redis.call("HSET", key, "hits", hits, "expiresAt", expires_at)

  if hits > limit then
    is_blocked = true
    block_expires_at = now + block_duration_ms
    redis.call("HSET", key, "blockExpiresAt", block_expires_at)
  end
end

local time_to_expire = math.ceil((expires_at - now) / 1000)
local time_to_block_expire = 0
if is_blocked then
  time_to_block_expire = math.ceil((block_expires_at - now) / 1000)
end

local ttl_seconds = math.ceil(math.max(ttl_ms, block_duration_ms) / 1000)
if ttl_seconds > 0 then
  redis.call("EXPIRE", key, ttl_seconds)
end

return {hits, time_to_expire, is_blocked and 1 or 0, time_to_block_expire}
`;
