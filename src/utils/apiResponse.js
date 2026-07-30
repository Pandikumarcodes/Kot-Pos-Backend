const send = (res, statusCode, body) => res.status(statusCode).json(body);

const success = (res, data, message = "Success", statusCode = 200) =>
  send(res, statusCode, {
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
  });

const created = (res, data, message = "Created") =>
  success(res, data, message, 201);

const failure = (res, statusCode, message, extra = {}) =>
  send(res, statusCode, {
    success: false,
    message,
    // Keep the legacy `error` field for existing clients during migration.
    error: message,
    ...extra,
  });

const badRequest = (res, message = "Bad request") =>
  failure(res, 400, message);
const unauthorized = (res, message = "Unauthorized") =>
  failure(res, 401, message);
const forbidden = (res, message = "Forbidden") =>
  failure(res, 403, message);
const notFound = (res, message = "Resource not found") =>
  failure(res, 404, message);
const conflict = (res, message = "Conflict") => failure(res, 409, message);
const validationError = (res, errors, statusCode = 422) =>
  failure(res, statusCode, "Validation failed", { errors });
const tooManyRequests = (res, message = "Too many requests", extra = {}) =>
  failure(res, 429, message, extra);
const serverError = (res, message = "Internal server error") =>
  failure(res, 500, message);

module.exports = {
  failure,
  success,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  tooManyRequests,
  serverError,
};
