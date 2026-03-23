// backend/middleware/errorLogger.js
// ─────────────────────────────────────────────────────────────
// Express error-handling middleware — logs unhandled errors
// with full stack traces before sending a clean response.
//
// Usage in server.js — add AFTER all routes:
//   const errorLogger = require("./middleware/errorLogger");
//   app.use(errorLogger);
// ─────────────────────────────────────────────────────────────

const logger = require("../config/logger");

// eslint-disable-next-line no-unused-vars
module.exports = function errorLogger(err, req, res, next) {
  // Log full error with context
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id ?? null,
    userRole: req.user?.role ?? null,
    body: req.body, // careful — mask sensitive fields in prod
  });

  // Don't leak stack traces to the client
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
  });
};
