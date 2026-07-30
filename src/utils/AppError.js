class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isOperational = options.isOperational !== false;
    this.errors = options.errors;
    Error.captureStackTrace?.(this, AppError);
  }
}

module.exports = AppError;
