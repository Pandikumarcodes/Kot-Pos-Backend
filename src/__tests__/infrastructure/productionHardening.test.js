jest.mock("../../infrastructure/cache/redisClient", () => ({
  getRedisClient: jest.fn(),
  redisStatus: jest.fn(() => ({ configured: true, connected: true })),
}));

const express = require("express");
const request = require("supertest");
const { getRedisClient, redisStatus } = require("../../infrastructure/cache/redisClient");
const { RedisRateLimitStore, createRateLimiter } = require("../../middlewares/ratelimiter");
const { validateEnvironment } = require("../../infrastructure/health/startupValidator");
const { EnvironmentValidationError } = require("../../infrastructure/health/errors");

const baseEnv = {
  MONGO_URI: "mongodb://localhost:27017/kot",
  JWT_SECRET: "a".repeat(20),
  REFRESH_TOKEN_SECRET: "b".repeat(20),
  PORT: "3000",
  NODE_ENV: "test",
};

describe("production hardening", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    redisStatus.mockReturnValue({ configured: true, connected: true });
  });

  test("returns Redis INCR's incremented count for the first and second hits", async () => {
    const client = {
      isReady: true,
      incr: jest.fn().mockResolvedValueOnce("1").mockResolvedValueOnce(2),
      pExpire: jest.fn().mockResolvedValue(1),
      pTTL: jest.fn().mockResolvedValue("59000"),
    };
    getRedisClient.mockReturnValue(client);
    const store = new RedisRateLimitStore({ prefix: "test" });
    store.init({ windowMs: 60000 });

    const first = await store.increment("127.0.0.1");
    const second = await store.increment("127.0.0.1");

    expect(first).toMatchObject({ totalHits: 1, resetTime: expect.any(Date) });
    expect(second).toMatchObject({ totalHits: 2, resetTime: expect.any(Date) });
    expect(Number.isNaN(first.resetTime.getTime())).toBe(false);
    expect(client.incr).toHaveBeenNthCalledWith(1, "test:127.0.0.1");
    expect(client.pExpire).toHaveBeenCalledTimes(1);
    expect(client.pExpire).toHaveBeenCalledWith("test:127.0.0.1", 60000);
  });

  test.each([0, -1, NaN, undefined, 1.5])(
    "rejects an invalid Redis hit count (%p) instead of returning it",
    async (redisHits) => {
      const client = {
        isReady: true,
        incr: jest.fn().mockResolvedValue(redisHits),
        pExpire: jest.fn(),
        pTTL: jest.fn(),
      };
      getRedisClient.mockReturnValue(client);
      const store = new RedisRateLimitStore();

      await expect(store.increment("client")).rejects.toThrow("invalid hit count");
    },
  );

  test("Redis unavailable path throws and never returns totalHits zero", async () => {
    getRedisClient.mockReturnValue(null);
    const store = new RedisRateLimitStore();
    store.init({ windowMs: 60000 });

    await expect(store.increment("client")).rejects.toThrow("Redis rate limiter is unavailable");
  });

  test("expiry and resetKey each restart the counter at one", async () => {
    let hits;
    const client = {
      isReady: true,
      incr: jest.fn(async () => {
        hits = (hits || 0) + 1;
        return hits;
      }),
      pExpire: jest.fn().mockResolvedValue(1),
      pTTL: jest.fn().mockResolvedValue(60000),
      del: jest.fn(async () => {
        hits = undefined;
        return 1;
      }),
    };
    getRedisClient.mockReturnValue(client);
    const store = new RedisRateLimitStore({ prefix: "expiry" });
    store.init({ windowMs: 60000 });

    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 1 });
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 2 });
    hits = undefined; // Simulate Redis expiring the fixed-window key.
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 1 });
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 2 });
    await store.resetKey("client");
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 1 });
    expect(client.del).toHaveBeenCalledWith("expiry:client");
    expect(client.pExpire).toHaveBeenCalledTimes(3);
  });

  test("decrement atomically floors the persisted counter instead of creating negatives", async () => {
    let hits = 1;
    const client = {
      isReady: true,
      eval: jest.fn(async () => {
        if (hits <= 1) {
          hits = undefined;
          return 0;
        }
        hits -= 1;
        return hits;
      }),
      incr: jest.fn(async () => {
        hits = (hits || 0) + 1;
        return hits;
      }),
      pExpire: jest.fn().mockResolvedValue(1),
      pTTL: jest.fn().mockResolvedValue(60000),
    };
    getRedisClient.mockReturnValue(client);
    const store = new RedisRateLimitStore({ prefix: "decrement" });

    await store.decrement("client");
    expect(hits).toBeUndefined();
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 1 });
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("DEL", KEYS[1])'),
      { keys: ["decrement:client"], arguments: [] },
    );
  });

  test("express-rate-limit accepts the store result without ERR_ERL_INVALID_HITS", async () => {
    const client = {
      isReady: true,
      incr: jest.fn().mockResolvedValue("1"),
      pExpire: jest.fn().mockResolvedValue(1),
      pTTL: jest.fn().mockResolvedValue(60000),
    };
    getRedisClient.mockReturnValue(client);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const limiter = createRateLimiter({ windowMs: 60000, max: 10, prefix: "integration" });
    process.env.NODE_ENV = previousNodeEnv;
    const app = express().get("/limited", limiter, (req, res) => res.sendStatus(204));

    await request(app).get("/limited").expect(204);

    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("ERR_ERL_INVALID_HITS");
  });

  test("express-rate-limit preserves fail-open behavior for a Redis outage", async () => {
    getRedisClient.mockReturnValue(null);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const limiter = createRateLimiter({ windowMs: 60000, max: 10, prefix: "fail-open" });
    process.env.NODE_ENV = previousNodeEnv;
    const app = express().get("/limited", limiter, (req, res) => res.sendStatus(204));

    await request(app).get("/limited").expect(204);

    const errors = consoleError.mock.calls.flat().join(" ");
    expect(errors).toContain("allowing request without rate-limiting");
    expect(errors).not.toContain("ERR_ERL_INVALID_HITS");
  });

  test("parses and validates optional production configuration", () => {
    const config = validateEnvironment({ ...baseEnv, REDIS_URL: "redis://localhost:6379", CACHE_TTL: "60", QUEUE_CONCURRENCY: "4", RATE_LIMIT_MAX: "20" });
    expect(config).toMatchObject({ cacheTtl: 60, queueConcurrency: 4, redisUrl: "redis://localhost:6379" });
    expect(() => validateEnvironment({ ...baseEnv, RATE_LIMIT_MAX: "0" })).toThrow(EnvironmentValidationError);
    expect(() => validateEnvironment({ ...baseEnv, REDIS_URL: "not-a-redis-url" })).toThrow(EnvironmentValidationError);
  });
});
