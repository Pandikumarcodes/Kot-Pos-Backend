class HealthInfrastructureError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class EnvironmentValidationError extends HealthInfrastructureError {
  constructor(errors) {
    super("Environment validation failed", "ENVIRONMENT_VALIDATION_ERROR", {
      fields: errors.map(({ field, reason }) => ({ field, reason })),
    });
    this.fields = errors;
  }
}

class HealthCheckError extends HealthInfrastructureError {
  constructor(message, details = {}) {
    super(message, "HEALTH_CHECK_ERROR", details);
  }
}

class ShutdownTimeoutError extends HealthInfrastructureError {
  constructor(name, timeoutMs) {
    super(`Shutdown callback timed out: ${name}`, "SHUTDOWN_TIMEOUT", {
      name,
      timeoutMs,
    });
    this.callbackName = name;
    this.timeoutMs = timeoutMs;
  }
}

class LifecycleTransitionError extends HealthInfrastructureError {
  constructor(from, to) {
    super(`Invalid lifecycle transition from ${from} to ${to}`, "INVALID_LIFECYCLE_TRANSITION", { from, to });
  }
}

module.exports = {
  HealthInfrastructureError,
  EnvironmentValidationError,
  HealthCheckError,
  ShutdownTimeoutError,
  LifecycleTransitionError,
};
