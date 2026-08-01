const { isDeepStrictEqual } = require("node:util");
const AuditValidationError = require("./errors/AuditValidationError");
const AUDIT_LIMITS = require("./auditLimits");
const { CHANGE_OPERATIONS, enumValues } = require("./auditEnums");

const isMongooseDocument = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value.$__ || value.constructor?.modelName),
  );

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  value?._bsontype !== "ObjectId";

const flatten = (value, prefix = "", output = new Map()) => {
  if (!isPlainObject(value)) {
    if (prefix) output.set(prefix, value);
    return output;
  }
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(entry)) flatten(entry, path, output);
    else output.set(path, entry);
  }
  return output;
};

const pathAllowed = (path, allowedPaths) =>
  allowedPaths.includes("*") ||
  allowedPaths.some(
    (allowed) =>
      path === allowed ||
      (allowed.endsWith(".*") && path.startsWith(allowed.slice(0, -1))),
  );

class ChangeSetBuilder {
  build({
    operation,
    before = {},
    after = {},
    allowedPaths = [],
    maxChanges = AUDIT_LIMITS.maxChanges,
    classification = null,
  } = {}) {
    if (!enumValues(CHANGE_OPERATIONS).includes(operation)) {
      throw new AuditValidationError("Unsupported audit change operation");
    }
    if (isMongooseDocument(before) || isMongooseDocument(after)) {
      throw new AuditValidationError(
        "Mongoose documents must not be passed to ChangeSetBuilder",
      );
    }
    if (!Array.isArray(allowedPaths) || !allowedPaths.length) return [];
    if (!Number.isInteger(maxChanges) || maxChanges < 0) {
      throw new AuditValidationError("maxChanges must be a non-negative integer");
    }

    const beforeFields = flatten(before);
    const afterFields = flatten(after);
    const paths = new Set([...beforeFields.keys(), ...afterFields.keys()]);
    const changes = [];

    for (const path of paths) {
      if (!pathAllowed(path, allowedPaths)) continue;
      const oldValue = beforeFields.get(path);
      const newValue = afterFields.get(path);
      if (isDeepStrictEqual(oldValue, newValue)) continue;

      const change = {
        path,
        operation,
        before: oldValue === undefined ? null : oldValue,
        after: newValue === undefined ? null : newValue,
      };
      if (classification) change.classification = classification;

      if (
        operation === CHANGE_OPERATIONS.INCREMENT ||
        operation === CHANGE_OPERATIONS.DECREMENT
      ) {
        if (typeof oldValue !== "number" || typeof newValue !== "number") {
          throw new AuditValidationError(
            `${operation} changes require numeric before and after values`,
          );
        }
        change.delta = newValue - oldValue;
        if (
          (operation === CHANGE_OPERATIONS.INCREMENT && change.delta <= 0) ||
          (operation === CHANGE_OPERATIONS.DECREMENT && change.delta >= 0)
        ) {
          throw new AuditValidationError(
            `${operation} change direction does not match its values`,
          );
        }
      }

      changes.push(change);
      if (changes.length > maxChanges) {
        throw new AuditValidationError("Audit change count exceeds policy limit");
      }
    }
    return changes;
  }
}

module.exports = ChangeSetBuilder;
module.exports.pathAllowed = pathAllowed;
