const AppError = require("../utils/AppError");
const { failure } = require("../utils/apiResponse");

const forwardError = (next, err, fallbackMessage, fallbackStatus = 500) => {
  if (err instanceof AppError) return next(err);
  return next(new AppError(fallbackMessage || err.message, fallbackStatus));
};

const handleControllerError = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  return failure(res, err.statusCode || err.status || 500, err.message || "Internal server error");
};

module.exports = { forwardError, handleControllerError };
