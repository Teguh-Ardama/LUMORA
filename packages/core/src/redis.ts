import { Redis } from "ioredis";
import { getEnv } from "./env";

/**
 * Shared Redis connections. BullMQ needs `maxRetriesPerRequest: null`;
 * pub/sub needs dedicated connections (a subscribing connection cannot
 * issue regular commands).
 */
const globalForRedis = globalThis as unknown as {
  lumoraRedis?: Redis;
  lumoraRedisSub?: Redis;
};

export function getRedis(): Redis {
  if (!globalForRedis.lumoraRedis) {
    globalForRedis.lumoraRedis = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    globalForRedis.lumoraRedis.on("error", (err) => console.error("[redis]", err.message));
  }
  return globalForRedis.lumoraRedis;
}

export function getRedisSubscriber(): Redis {
  if (!globalForRedis.lumoraRedisSub) {
    globalForRedis.lumoraRedisSub = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    globalForRedis.lumoraRedisSub.on("error", (err) => console.error("[redis:sub]", err.message));
  }
  return globalForRedis.lumoraRedisSub;
}
