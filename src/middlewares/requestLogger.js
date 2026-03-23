// Express middleware — logs every request and response.
// Logs include:
//   method, url, statusCode, responseTime (ms),
//   userAgent, ip, userId (if authenticated)
//
// Usage in server.js — add BEFORE your routes:
//   const requestLogger = require("./middleware/requestLogger");
//   app.use(requestLogger);
// ─────────────────────────────────────────────────────────────

const logger = require("../config/logger");

// Paths to skip (health checks, static files)
const SKIP_PATHS = ["/favicon.ico", "/health", "/api/version"];

module.exports = function requestLogger(req, res, next) {
  // Skip noisy paths
  if (SKIP_PATHS.includes(req.path)) return next();

  const start = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const ms = Date.now() - start;
    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("HTTP", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${ms}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      userId: req.user?._id ?? null,
      userRole: req.user?.role ?? null,
    });
  });

  next();
};
