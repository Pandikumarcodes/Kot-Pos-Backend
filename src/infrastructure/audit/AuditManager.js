const AuditContext = require("./AuditContext");
const AuditEventFactory = require("./AuditEventFactory");
const AuditPolicyRegistry = require("./AuditPolicyRegistry");
const ChangeSetBuilder = require("./ChangeSetBuilder");
const Redactor = require("./Redactor");
const auditRepository = require("../../repositories/AuditRepository");
const AuditValidationError = require("./errors/AuditValidationError");
const AuditWriteError = require("./errors/AuditWriteError");

const METADATA_KEYS = Object.freeze([
  "requestId",
  "source",
  "service",
  "route",
  "method",
  "reasonCode",
  "errorCode",
  "ipHash",
  "userAgentFamily",
  "parentEntityType",
  "parentEntityId",
  "affectedEntityIds",
  "affectedCount",
  "businessReference",
  "truncated",
]);

const selectMetadata = (context, supplied = {}) => {
  const combined = {
    requestId: context.requestId,
    source: context.source,
    route: context.route,
    method: context.method,
    ipHash: context.ipHash,
    userAgentFamily: context.userAgentFamily,
    ...supplied,
  };
  return Object.fromEntries(
    METADATA_KEYS.filter((key) => combined[key] !== undefined).map((key) => [
      key,
      combined[key],
    ]),
  );
};

class AuditManager {
  constructor({
    repository = auditRepository,
    policyRegistry = AuditPolicyRegistry.defaultRegistry,
    eventFactory = new AuditEventFactory(),
    changeSetBuilder = new ChangeSetBuilder(),
    redactor = new Redactor(),
  } = {}) {
    this.repository = repository;
    this.policyRegistry = policyRegistry;
    this.eventFactory = eventFactory;
    this.changeSetBuilder = changeSetBuilder;
    this.redactor = redactor;
  }

  async record(intent, { session } = {}) {
    const event = this.#prepare(intent);
    try {
      await this.repository.insert(event, session ? { session } : {});
      return event;
    } catch (error) {
      if (error instanceof AuditValidationError) throw error;
      throw new AuditWriteError(undefined, error);
    }
  }

  async recordMany(intents, { session } = {}) {
    if (!Array.isArray(intents) || !intents.length) {
      throw new AuditValidationError("Audit recordMany requires event intents");
    }
    const events = intents.map((intent) => this.#prepare(intent));
    const maxBatchSize = Math.min(
      ...intents.map(
        (intent) =>
          this.policyRegistry.getPolicy(intent.action).payloadLimits.maxBatchSize,
      ),
    );
    if (events.length > maxBatchSize) {
      throw new AuditValidationError("Audit batch exceeds policy limit");
    }
    try {
      await this.repository.insertMany(events, session ? { session } : {});
      return Object.freeze(events);
    } catch (error) {
      if (error instanceof AuditValidationError) throw error;
      throw new AuditWriteError(undefined, error);
    }
  }

  #prepare(intent) {
    if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
      throw new AuditValidationError("Audit event intent must be an object");
    }
    const policy = this.policyRegistry.getPolicy(intent.action);
    const context =
      intent.context instanceof AuditContext
        ? intent.context
        : new AuditContext(intent.context);
    const rawChanges = intent.change
      ? this.changeSetBuilder.build({
          ...intent.change,
          allowedPaths: policy.allowedChangePaths,
          maxChanges: policy.payloadLimits.maxChanges,
          classification: policy.retentionClass,
        })
      : [];
    const changes = this.redactor.redact(rawChanges);
    const metadata = this.redactor.redact(
      selectMetadata(context, intent.metadata),
    );
    if (
      Array.isArray(metadata.affectedEntityIds) &&
      metadata.affectedEntityIds.length >
        policy.payloadLimits.maxAffectedEntityIds
    ) {
      throw new AuditValidationError(
        "affectedEntityIds exceeds policy limit",
      );
    }

    const event = this.eventFactory.create({
      intent,
      context,
      policy,
      changes,
      metadata,
    });
    const byteLength = Buffer.byteLength(JSON.stringify(event), "utf8");
    if (byteLength > policy.payloadLimits.maxEventBytes) {
      throw new AuditValidationError("Audit event exceeds policy payload limit", {
        byteLength,
        maxEventBytes: policy.payloadLimits.maxEventBytes,
      });
    }
    return event;
  }
}

module.exports = AuditManager;
