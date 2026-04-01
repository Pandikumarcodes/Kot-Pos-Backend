const isProduction = process.env.NODE_ENV === "production";

// ── Access Token Cookie ───────────────────────────────────────
// Short-lived (15 min), sent on every request
const accessCookieOptions = {
  httpOnly: true, // JS cannot read it
  secure: isProduction, // HTTPS only in production
  sameSite: isProduction ? "none" : "lax", // "none" required for cross-origin
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: "/", // sent on all requests
};

// ── Refresh Token Cookie ──────────────────────────────────────
// Long-lived (7 days), restricted to only the refresh endpoint
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/api/v1/auth/refresh", // ✅ only sent to refresh endpoint
};

// ── Clear Cookie Helper ───────────────────────────────────────
// path must exactly match the path used when setting the cookie
// otherwise the browser won't find and delete it
const clearCookieOptions = (cookiePath = "/") => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 0, // expire immediately
  path: cookiePath, // must match the original path
});

module.exports = {
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
};
