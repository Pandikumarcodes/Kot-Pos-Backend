jest.mock("../../infrastructure/cache/redisClient", () => ({
  getRedisClient: jest.fn(),
  redisStatus: jest.fn(() => ({ configured: true, connected: true })),
}));

const { getRedisClient } = require("../../infrastructure/cache/redisClient");
const { RedisRateLimitStore } = require("../../middlewares/ratelimiter");
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
  afterEach(() => jest.clearAllMocks());

  test("uses Redis fixed-window counters and expiry", async () => {
    const client = { isReady: true, incr: jest.fn().mockResolvedValue(1), pExpire: jest.fn().mockResolvedValue(1), pTTL: jest.fn().mockResolvedValue(59000) };
    getRedisClient.mockReturnValue(client);
    const store = new RedisRateLimitStore({ prefix: "test" });
    store.init({ windowMs: 60000 });
    const result = await store.increment("127.0.0.1");
    expect(result.totalHits).toBe(1);
    expect(client.incr).toHaveBeenCalledWith("test:127.0.0.1");
    expect(client.pExpire).toHaveBeenCalledWith("test:127.0.0.1", 60000);
  });

  test("fails open when Redis is unavailable", async () => {
    getRedisClient.mockReturnValue(null);
    const store = new RedisRateLimitStore();
    store.init({ windowMs: 60000 });
    const result = await store.increment("client");
    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  test("returns post-increment integer counts", async () => {
    const client = {
      isReady: true,
      incr: jest.fn().mockResolvedValueOnce("1").mockResolvedValueOnce("2"),
      pExpire: jest.fn().mockResolvedValue(1),
      pTTL: jest.fn().mockResolvedValue(59000),
    };
    getRedisClient.mockReturnValue(client);
    const store = new RedisRateLimitStore({ prefix: "test" });
    store.init({ windowMs: 60000 });
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 1 });
    await expect(store.increment("client")).resolves.toMatchObject({ totalHits: 2 });
  });

  test("parses and validates optional production configuration", () => {
    const config = validateEnvironment({ ...baseEnv, REDIS_URL: "redis://localhost:6379", CACHE_TTL: "60", QUEUE_CONCURRENCY: "4", RATE_LIMIT_MAX: "20" });
    expect(config).toMatchObject({ cacheTtl: 60, queueConcurrency: 4, redisUrl: "redis://localhost:6379" });
    expect(() => validateEnvironment({ ...baseEnv, RATE_LIMIT_MAX: "0" })).toThrow(EnvironmentValidationError);
    expect(() => validateEnvironment({ ...baseEnv, REDIS_URL: "not-a-redis-url" })).toThrow(EnvironmentValidationError);
  });
});
