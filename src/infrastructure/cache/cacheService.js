const logger = require("../../config/logger");
const { getRedisClient, redisStatus } = require("./redisClient");
const { CacheMetrics } = require("./cacheMetrics");

const metrics = new CacheMetrics();
const DEFAULT_TTL_SECONDS = 300;

const withTimeout = (
  promise,
  timeoutMs = Number(process.env.REDIS_OPERATION_TIMEOUT_MS) || 500,
) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Redis operation timed out")),
        timeoutMs,
      ),
    ),
  ]);

const cache = {
  async get(key) {
    const client = getRedisClient();
    if (!client?.isReady) {
      metrics.increment("bypasses");
      return undefined;
    }
    try {
      const value = await withTimeout(client.get(key));
      if (value === null) {
        metrics.increment("misses");
        return undefined;
      }
      metrics.increment("hits");
      return JSON.parse(value);
    } catch (error) {
      metrics.increment("errors");
      logger.warn("Redis cache read failed", { key, error: error.message });
      return undefined;
    }
  },

  async set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const client = getRedisClient();
    if (!client?.isReady) {
      metrics.increment("bypasses");
      return false;
    }
    try {
      await withTimeout(
        client.set(key, JSON.stringify(value), { EX: ttlSeconds }),
      );
      metrics.increment("sets");
      return true;
    } catch (error) {
      metrics.increment("errors");
      logger.warn("Redis cache write failed", { key, error: error.message });
      return false;
    }
  },

  async getOrSet(key, loader, { ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
    const cached = await this.get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  },

  async del(key) {
    const client = getRedisClient();
    if (!client?.isReady) {
      metrics.increment("bypasses");
      return false;
    }
    try {
      await withTimeout(client.del(key));
      metrics.increment("deletes");
      return true;
    } catch (error) {
      metrics.increment("errors");
      logger.warn("Redis cache delete failed", { key, error: error.message });
      return false;
    }
  },

  async invalidatePattern(pattern) {
    const client = getRedisClient();
    if (!client?.isReady) {
      metrics.increment("bypasses");
      return 0;
    }
    let deleted = 0;
    try {
      for await (const key of client.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        deleted += await client.del(key);
      }
      metrics.counters.deletes += deleted;
      return deleted;
    } catch (error) {
      metrics.increment("errors");
      logger.warn("Redis cache invalidation failed", {
        pattern,
        error: error.message,
      });
      return deleted;
    }
  },

  metrics: () => ({ ...redisStatus(), ...metrics.snapshot() }),
  resetMetrics: () => metrics.reset(),
};

module.exports = { cache, DEFAULT_TTL_SECONDS };
