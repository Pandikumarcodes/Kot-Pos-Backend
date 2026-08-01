const AuditValidationError = require("./errors/AuditValidationError");
const { ACTOR_TYPES, enumValues } = require("./auditEnums");

const toIdentifier = (value) =>
  value === null || value === undefined ? null : String(value);

class AuditContext {
  constructor({
    actor = null,
    actorRole = null,
    actorType,
    branchId = null,
    correlationId,
    requestId = null,
    source = "APPLICATION",
    route = null,
    method = null,
    ipHash = null,
    userAgentFamily = null,
  } = {}) {
    if (!enumValues(ACTOR_TYPES).includes(actorType)) {
      throw new AuditValidationError("A valid audit actorType is required");
    }
    if (actorType === ACTOR_TYPES.USER && !actor) {
      throw new AuditValidationError("User audit actors require an actor ID");
    }
    if (typeof correlationId !== "string" || !correlationId.trim()) {
      throw new AuditValidationError("A correlationId is required");
    }

    this.actor = toIdentifier(actor);
    this.actorRole = actorRole === null ? null : String(actorRole);
    this.actorType = actorType;
    this.branchId = toIdentifier(branchId);
    this.correlationId = correlationId.trim();
    this.requestId = toIdentifier(requestId);
    this.source = String(source || "APPLICATION");
    this.route = route === null ? null : String(route);
    this.method = method === null ? null : String(method).toUpperCase();
    this.ipHash = ipHash === null ? null : String(ipHash);
    this.userAgentFamily =
      userAgentFamily === null ? null : String(userAgentFamily);

    Object.freeze(this);
  }

  toObject() {
    return { ...this };
  }
}

module.exports = AuditContext;
