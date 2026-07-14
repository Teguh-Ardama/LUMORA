import { getRedis } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in Redis. Fails OPEN: if Redis is unreachable the
 * request proceeds — availability of the booth beats strictness here,
 * and auth still protects every route.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const windowKey = `rl:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await redis.incr(windowKey);
    if (count === 1) await redis.expire(windowKey, windowSeconds);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: windowSeconds,
    };
  } catch {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}
