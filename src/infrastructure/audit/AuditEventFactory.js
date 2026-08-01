const crypto = require("node:crypto");
const AuditValidationError = require("./errors/AuditValidationError");
const {
  AUDIT_OUTCOMES,
  ENTITY_TYPES,
  enumValues,
} = require("./auditEnums");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const deepFreeze = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
};

const identifier = (value) =>
  value === null || value === undefined ? null : String(value);

class AuditEventFactory {
  constructor({ clock = () => new Date(), idFactory = () => crypto.randomUUID() } = {}) {
    this.clock = clock;
    this.idFactory = idFactory;
  }

  create({ intent, context, policy, changes, metadata }) {
    if (!intent || typeof intent !== "object") {
      throw new AuditValidationError("Audit event intent is required");
    }
    if (!enumValues(AUDIT_OUTCOMES).includes(intent.outcome)) {
      throw new AuditValidationError("A valid audit outcome is required");
    }
    if (
      intent.entityType &&
      (!enumValues(ENTITY_TYPES).includes(intent.entityType) ||
        intent.entityType !== policy.entityType)
    ) {
      throw new AuditValidationError(
        "Audit entityType does not match the registered action policy",
      );
    }

    const eventId = intent.eventId || this.idFactory();
    if (typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) {
      throw new AuditValidationError("eventId must be a valid UUID");
    }
    const timestamp = this.clock();
    if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
      throw new AuditValidationError("Audit clock must return a valid Date");
    }

    const entityId = identifier(intent.entityId);
    if (
      !entityId &&
      ![ENTITY_TYPES.AUTHENTICATION, ENTITY_TYPES.SYSTEM].includes(
        policy.entityType,
      )
    ) {
      throw new AuditValidationError(
        `entityId is required for ${policy.entityType} audit events`,
      );
    }

    const expiresAt = Number.isFinite(policy.retentionDays)
      ? new Date(timestamp.getTime() + policy.retentionDays * 86400000)
      : null;

    return deepFreeze({
      eventId,
      schemaVersion: 1,
      timestamp: new Date(timestamp.getTime()),
      level: policy.level,
      retentionClass: policy.retentionClass,
      expiresAt,
      actor: context.actor,
      actorRole: context.actorRole,
      actorType: context.actorType,
      branchId: context.branchId,
      entityType: policy.entityType,
      entityId,
      action: policy.action,
      outcome: intent.outcome,
      changes,
      metadata,
      correlationId: context.correlationId,
      transactionId: identifier(intent.transactionId),
    });
  }
}

module.exports = AuditEventFactory;
module.exports.deepFreeze = deepFreeze;
