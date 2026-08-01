const AuditValidationError = require("./errors/AuditValidationError");
const AUDIT_LIMITS = require("./auditLimits");

const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const CIRCULAR = "[CIRCULAR]";
const MAX_DEPTH = "[MAX_DEPTH]";

const SECRET_FRAGMENTS = Object.freeze([
  "password",
  "token",
  "jwt",
  "authorization",
  "cookie",
  "apikey",
  "secret",
  "privatekey",
  "cvv",
  "pin",
  "cardnumber",
]);

const normalizeKey = (key) =>
  String(key).toLowerCase().replace(/[^a-z0-9]/g, "");

const isSensitiveKey = (key) => {
  const normalized = normalizeKey(key);
  return SECRET_FRAGMENTS.some((fragment) => normalized.includes(fragment));
};

const isMongooseDocument = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value.$__ || value.constructor?.modelName),
  );

const sanitizeString = (value, maxLength) => {
  const withoutBearer = value.replace(
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    `Bearer ${REDACTED}`,
  );
  const withoutJwt = withoutBearer.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    REDACTED,
  );
  return withoutJwt.length > maxLength
    ? `${withoutJwt.slice(0, maxLength)}${TRUNCATED}`
    : withoutJwt;
};

class Redactor {
  constructor(limits = {}) {
    this.limits = Object.freeze({ ...AUDIT_LIMITS, ...limits });
  }

  redact(value) {
    return this.#walk(value, 0, new WeakSet());
  }

  #walk(value, depth, ancestors) {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") {
      return sanitizeString(value, this.limits.maxStringLength);
    }
    if (["number", "boolean"].includes(typeof value)) return value;
    if (["bigint", "symbol", "function"].includes(typeof value)) {
      return String(value);
    }
    if (value instanceof Date) return new Date(value.getTime());
    if (Buffer.isBuffer(value)) return "[BINARY_REMOVED]";
    if (value?._bsontype === "ObjectId") return value.toString();
    if (isMongooseDocument(value)) {
      throw new AuditValidationError(
        "Mongoose documents must be projected before audit redaction",
      );
    }
    if (depth >= this.limits.maxDepth) return MAX_DEPTH;
    if (ancestors.has(value)) return CIRCULAR;

    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
      result = value
        .slice(0, this.limits.maxArrayLength)
        .map((entry) => this.#walk(entry, depth + 1, ancestors));
      if (value.length > this.limits.maxArrayLength) result.push(TRUNCATED);
    } else {
      result = {};
      const entries = Object.entries(value).slice(
        0,
        this.limits.maxObjectKeys,
      );
      for (const [key, entry] of entries) {
        result[key] = isSensitiveKey(key)
          ? REDACTED
          : this.#walk(entry, depth + 1, ancestors);
      }
      if (Object.keys(value).length > this.limits.maxObjectKeys) {
        result._truncated = true;
      }
    }
    ancestors.delete(value);
    return result;
  }
}

module.exports = Redactor;
module.exports.REDACTED = REDACTED;
module.exports.isSensitiveKey = isSensitiveKey;
