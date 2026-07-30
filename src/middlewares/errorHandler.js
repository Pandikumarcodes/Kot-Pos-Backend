const logger = require("../config/logger");
const AppError = require("../utils/AppError");
const { failure } = require("../utils/apiResponse");

const SAFE_STATUS_CODES = new Set([400, 401, 403, 404, 409, 422, 429]);
const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|apikey|api_key/i;

const redact = (value, depth = 0) => {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).slice(0, 50).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redact(item, depth + 1),
    ]),
  );
};

const getValidationErrors = (err) =>
  Object.values(err.errors || {}).map((item) => ({
    field: item.path,
    message: item.message,
  }));

const normalizeError = (err) => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, errors: err.errors };
  }

  if (err?.name === "ValidationError") {
    return { statusCode: 422, message: "Validation failed", errors: getValidationErrors(err) };
  }
  if (err?.code === 11000) {
    return { statusCode: 409, message: "A resource with these details already exists" };
  }
  if (err?.name === "CastError") {
    return { statusCode: 400, message: `Invalid ${err.path || "request value"}` };
  }
  if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(err?.name)) {
    return { statusCode: 401, message: "Invalid or expired token" };
  }
  if (SAFE_STATUS_CODES.has(err?.statusCode || err?.status)) {
    return { statusCode: err.statusCode || err.status, message: err.message || "Request failed" };
  }

  return { statusCode: 500, message: "Internal server error" };
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const normalized = normalizeError(err);
  const isInternal = normalized.statusCode >= 500;
  logger.error("Unhandled request error", {
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id ?? null,
    userRole: req.user?.role ?? null,
    body: redact(req.body),
    query: redact(req.query),
    params: redact(req.params),
  });

  return failure(
    res,
    normalized.statusCode,
    isInternal ? "Internal server error" : normalized.message,
    normalized.errors ? { errors: normalized.errors } : {},
  );
};

module.exports = errorHandler;
module.exports.redact = redact;
module.exports.normalizeError = normalizeError;
