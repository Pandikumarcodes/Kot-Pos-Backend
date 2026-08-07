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

  init(options) { this.windowMs = options.windowMs; }

  async increment(identifier) {
    const resetTime = new Date(Date.now() + this.windowMs);
    const client = getRedisClient();
    if (!client?.isReady || !redisStatus().configured) {
      return { totalHits: 1, resetTime };
    }

    const key = `${this.prefix}:${identifier}`;
    try {
      let timeoutId;
      const rawTotalHits = await Promise.race([
        client.incr(key),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Redis rate limit timed out")),
            toPositiveNumber(
              process.env.REDIS_TIMEOUT || process.env.REDIS_OPERATION_TIMEOUT_MS,
              500,
            ),
          );
        }),
      ]).finally(() => clearTimeout(timeoutId));
      const totalHits = Math.max(1, Math.floor(Number(rawTotalHits) || 1));
      if (totalHits === 1) await client.pExpire(key, this.windowMs);
      const remainingTtl = await client.pTTL(key);
      return {
        totalHits,
        resetTime: new Date(Date.now() + (remainingTtl > 0 ? remainingTtl : this.windowMs)),
      };
    } catch (error) {
      logger.warn("Redis rate limiter unavailable; request allowed", { error: error.message });
      return { totalHits: 1, resetTime };
    }
  }

  async decrement(identifier) {
    const client = getRedisClient();
    if (client?.isReady) await client.decr(`${this.prefix}:${identifier}`);
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

  // Redis is shared across application instances when configured. The store
  // remains fail-open if Redis is unavailable, preserving existing behavior.
  const { prefix, ...options } = config;
  return rateLimit({ ...options, store: new RedisRateLimitStore({ prefix }) });
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
