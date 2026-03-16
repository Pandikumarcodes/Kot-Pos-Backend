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

// ── Auth — strict (login/signup brute-force protection) ───────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many login attempts. Try again in 15 minutes."),
});

// ── General API — all normal page loads ───────────────────────
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many requests. Please slow down."),
});

// ── Reports — relaxed (4 parallel requests per page load) ─────
const reportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(
    "Too many report requests. Please wait before refreshing.",
  ),
});

// ── Order / Billing writes ────────────────────────────────────
const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler("Too many order requests. Please wait a moment."),
});

module.exports = { authLimiter, apiLimiter, reportLimiter, orderLimiter };
