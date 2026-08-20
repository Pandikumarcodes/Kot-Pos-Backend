const rateLimit = require("express-rate-limit");
const { tooManyRequests } = require("../utils/apiResponse");
const { getRedisClient, redisStatus } = require("../infrastructure/cache/redisClient");
const logger = require("../config/logger");

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const configuredWindow = (fallback) =>
  toPositiveNumber(process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW, fallback);

const configuredMax = (fallback) =>
  Math.floor(toPositiveNumber(process.env.RATE_LIMIT_MAX, fallback));

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("Redis rate limit timed out")),
    timeoutMs,
  );
  Promise.resolve(promise).then(
    (value) => {
      clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      clearTimeout(timer);
      reject(error);
    },
  );
});

const DECREMENT_WITH_FLOOR_SCRIPT = `
  local current = tonumber(redis.call("GET", KEYS[1]))
  if not current or current <= 1 then
    redis.call("DEL", KEYS[1])
    return 0
  end
  return redis.call("DECR", KEYS[1])
`;

/**
 * Small express-rate-limit store backed by the already configured node-redis
 * client. Redis failures fail open so an optional cache outage cannot turn
 * otherwise healthy HTTP requests into 5xx responses.
 */
class RedisRateLimitStore {
  constructor({ prefix = "kot-pos:rate-limit" } = {}) {
    this.prefix = prefix;
    this.windowMs = 60000;
  }

  init(options) {
    this.windowMs = Math.ceil(toPositiveNumber(options.windowMs, this.windowMs));
  }

  async increment(identifier) {
    const client = getRedisClient();
    if (!client?.isReady || !redisStatus().configured) {
      throw new Error("Redis rate limiter is unavailable");
    }

    const key = `${this.prefix}:${identifier}`;
    try {
      const redisHits = await withTimeout(
        client.incr(key),
        toPositiveNumber(process.env.REDIS_TIMEOUT || process.env.REDIS_OPERATION_TIMEOUT_MS, 500),
      );
      const totalHits = Number(redisHits);
      if (!Number.isSafeInteger(totalHits) || totalHits < 1) {
        throw new TypeError(`Redis INCR returned an invalid hit count: ${redisHits}`);
      }
      if (totalHits === 1) await client.pExpire(key, this.windowMs);
      const remainingTtl = Number(await client.pTTL(key));
      return {
        totalHits,
        resetTime: new Date(
          Date.now() + (Number.isFinite(remainingTtl) && remainingTtl > 0 ? remainingTtl : this.windowMs),
        ),
      };
    } catch (error) {
      logger.warn("Redis rate limiter unavailable; request allowed", { error: error.message });
      throw error;
    }
  }

  async decrement(identifier) {
    const client = getRedisClient();
    if (!client?.isReady) return;
    try {
      await client.eval(DECREMENT_WITH_FLOOR_SCRIPT, {
        keys: [`${this.prefix}:${identifier}`],
        arguments: [],
      });
    } catch (error) {
      logger.warn("Redis rate limiter decrement failed", { error: error.message });
    }
  }

  async resetKey(identifier) {
    const client = getRedisClient();
    if (client?.isReady) await client.del(`${this.prefix}:${identifier}`);
  }
}

// ✅ Custom handler — always sends Retry-After so frontend knows when to retry
const makeHandler = (message) => (req, res) => {
  const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
  res.setHeader("Retry-After", retryAfter);
  return tooManyRequests(res, message, { retryAfter });
};

/**
 * Helper to create rate limiters that bypass in test/E2E environments
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Express middleware
 */
const createRateLimiter = (config) => {
  // ✅ BYPASS RATE LIMITING IN TEST/E2E ENVIRONMENTS
  const isTestEnvironment =
    process.env.NODE_ENV === "test" || process.env.E2E_TESTING === "true";

  if (isTestEnvironment) {
    console.log(
      `[Rate Limiter] ⚠️  Bypassing rate limiting - E2E/Test mode enabled`,
    );
    return (req, res, next) => next(); // No-op middleware
  }

  // Redis is shared across application instances when configured. Store errors
  // are handed to express-rate-limit's supported fail-open path.
  const { prefix, ...options } = config;
  return rateLimit({
    ...options,
    passOnStoreError: true,
    store: new RedisRateLimitStore({ prefix }),
  });
};

// ── Auth — strict (login/signup brute-force protection) ───────
const authLimiter = createRateLimiter({
  windowMs: configuredWindow(15 * 60 * 1000), // 15 minutes
  max: configuredMax(20), // 20 requests per window
  prefix: "kot-pos:rate-limit:auth",
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many login attempts. Try again in 15 minutes."),
});

const signupLimiter = createRateLimiter({
  windowMs: configuredWindow(60 * 60 * 1000),
  max: configuredMax(5),
  prefix: "kot-pos:rate-limit:signup",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: "Too many accounts created. Please try again later." }),
});

// ── General API — all normal page loads ───────────────────────
const apiLimiter = createRateLimiter({
  windowMs: configuredWindow(1 * 60 * 1000), // 1 minute
  max: configuredMax(200), // 200 requests per window
  prefix: "kot-pos:rate-limit:api",
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many requests. Please slow down."),
});

// ── Reports — relaxed (4 parallel requests per page load) ─────
const reportLimiter = createRateLimiter({
  windowMs: configuredWindow(1 * 60 * 1000), // 1 minute
  max: configuredMax(80), // 80 requests per window
  prefix: "kot-pos:rate-limit:reports",
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    "Too many report requests. Please wait before refreshing.",
  ),
});

// ── Order / Billing writes ────────────────────────────────────
const orderLimiter = createRateLimiter({
  windowMs: configuredWindow(1 * 60 * 1000), // 1 minute
  max: configuredMax(60), // 60 requests per window
  prefix: "kot-pos:rate-limit:orders",
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many order requests. Please wait a moment."),
});

const publicLimiter = createRateLimiter({
  windowMs: configuredWindow(60 * 1000),
  max: configuredMax(120),
  prefix: "kot-pos:rate-limit:public",
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many public requests. Please try again shortly."),
});

const aiLimiter = createRateLimiter({
  windowMs: configuredWindow(60 * 1000),
  max: configuredMax(30),
  prefix: "kot-pos:rate-limit:ai",
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many AI requests. Please try again shortly."),
});

module.exports = { authLimiter, signupLimiter, apiLimiter, reportLimiter, orderLimiter, publicLimiter, aiLimiter, RedisRateLimitStore, createRateLimiter };
