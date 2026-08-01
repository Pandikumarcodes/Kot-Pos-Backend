class AuditValidationError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "AuditValidationError";
    this.code = "AUDIT_VALIDATION_ERROR";
    if (details !== undefined) this.details = details;
  }
}

module.exports = AuditValidationError;
