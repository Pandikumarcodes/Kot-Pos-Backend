const rateLimit = require("express-rate-limit");

// ✅ Custom handler — always sends Retry-After so frontend knows when to retry
const makeHandler = (message) => (req, res) => {
  const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
  res.setHeader("Retry-After", retryAfter);
  res.status(429).json({
    error: message,
    retryAfter, // seconds — frontend reads this to show countdown
  });
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

  // Production rate limiting
  return rateLimit(config);
};

// ── Auth — strict (login/signup brute-force protection) ───────
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many login attempts. Try again in 15 minutes."),
});

// ── General API — all normal page loads ───────────────────────
const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many requests. Please slow down."),
});

// ── Reports — relaxed (4 parallel requests per page load) ─────
const reportLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 80, // 80 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    "Too many report requests. Please wait before refreshing.",
  ),
});

// ── Order / Billing writes ────────────────────────────────────
const orderLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many order requests. Please wait a moment."),
});

module.exports = { authLimiter, apiLimiter, reportLimiter, orderLimiter };
