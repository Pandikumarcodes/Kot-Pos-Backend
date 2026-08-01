class AuditWriteError extends Error {
  constructor(message = "Audit event could not be persisted", cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "AuditWriteError";
    this.code = "AUDIT_WRITE_ERROR";
  }
}

module.exports = AuditWriteError;
