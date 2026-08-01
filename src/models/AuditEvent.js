const mongoose = require("mongoose");
const { AUDIT_ACTION_VALUES } = require("../infrastructure/audit/auditActions");
const {
  ACTOR_TYPES,
  AUDIT_LEVELS,
  AUDIT_OUTCOMES,
  CHANGE_OPERATIONS,
  ENTITY_TYPES,
  RETENTION_CLASSES,
  enumValues,
} = require("../infrastructure/audit/auditEnums");

const immutableField = (definition) => ({ ...definition, immutable: true });

const changeSchema = new mongoose.Schema(
  {
    path: immutableField({ type: String, required: true, maxlength: 200 }),
    operation: immutableField({
      type: String,
      enum: enumValues(CHANGE_OPERATIONS),
      required: true,
    }),
    before: immutableField({ type: mongoose.Schema.Types.Mixed, default: null }),
    after: immutableField({ type: mongoose.Schema.Types.Mixed, default: null }),
    delta: immutableField({ type: Number, default: null }),
    classification: immutableField({ type: String, default: null, maxlength: 50 }),
  },
  { _id: false, strict: "throw" },
);

const metadataSchema = new mongoose.Schema(
  {
    requestId: immutableField({ type: String, default: null, maxlength: 200 }),
    source: immutableField({ type: String, required: true, maxlength: 50 }),
    service: immutableField({ type: String, default: null, maxlength: 100 }),
    route: immutableField({ type: String, default: null, maxlength: 300 }),
    method: immutableField({ type: String, default: null, maxlength: 10 }),
    reasonCode: immutableField({ type: String, default: null, maxlength: 100 }),
    errorCode: immutableField({ type: String, default: null, maxlength: 100 }),
    ipHash: immutableField({ type: String, default: null, maxlength: 200 }),
    userAgentFamily: immutableField({ type: String, default: null, maxlength: 200 }),
    parentEntityType: immutableField({
      type: String,
      enum: [...enumValues(ENTITY_TYPES), null],
      default: null,
    }),
    parentEntityId: immutableField({ type: String, default: null, maxlength: 200 }),
    affectedEntityIds: immutableField({
      type: [{ type: String, maxlength: 200 }],
      default: undefined,
      validate: {
        validator: (ids) => !ids || ids.length <= 100,
        message: "affectedEntityIds exceeds its maximum size",
      },
    }),
    affectedCount: immutableField({ type: Number, min: 0, default: null }),
    businessReference: immutableField({ type: String, default: null, maxlength: 200 }),
    truncated: immutableField({ type: Boolean, default: false }),
  },
  { _id: false, strict: "throw" },
);

const auditEventSchema = new mongoose.Schema(
  {
    eventId: immutableField({
      type: String,
      required: true,
      unique: true,
      maxlength: 64,
    }),
    schemaVersion: immutableField({ type: Number, required: true, min: 1 }),
    timestamp: immutableField({ type: Date, required: true }),
    level: immutableField({
      type: String,
      enum: enumValues(AUDIT_LEVELS),
      required: true,
    }),
    retentionClass: immutableField({
      type: String,
      enum: enumValues(RETENTION_CLASSES),
      required: true,
    }),
    expiresAt: immutableField({ type: Date, default: null }),
    actor: immutableField({ type: String, default: null, maxlength: 200 }),
    actorRole: immutableField({ type: String, default: null, maxlength: 50 }),
    actorType: immutableField({
      type: String,
      enum: enumValues(ACTOR_TYPES),
      required: true,
    }),
    branchId: immutableField({
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    }),
    entityType: immutableField({
      type: String,
      enum: enumValues(ENTITY_TYPES),
      required: true,
    }),
    entityId: immutableField({ type: String, default: null, maxlength: 200 }),
    action: immutableField({
      type: String,
      enum: AUDIT_ACTION_VALUES,
      required: true,
    }),
    outcome: immutableField({
      type: String,
      enum: enumValues(AUDIT_OUTCOMES),
      required: true,
    }),
    changes: immutableField({ type: [changeSchema], default: [] }),
    metadata: immutableField({ type: metadataSchema, required: true }),
    correlationId: immutableField({ type: String, required: true, maxlength: 200 }),
    transactionId: immutableField({ type: String, default: null, maxlength: 200 }),
  },
  {
    collection: "audit_events",
    strict: "throw",
    timestamps: false,
    versionKey: false,
  },
);

auditEventSchema.index({ branchId: 1, timestamp: -1, _id: -1 });
auditEventSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditEventSchema.index({ actor: 1, timestamp: -1 });
auditEventSchema.index({ action: 1, timestamp: -1 });
auditEventSchema.index({ correlationId: 1, timestamp: 1 });
auditEventSchema.index({ transactionId: 1, timestamp: 1 });
auditEventSchema.index(
  { outcome: 1, timestamp: -1 },
  {
    partialFilterExpression: {
      outcome: {
        $in: enumValues(AUDIT_OUTCOMES).filter(
          (outcome) => outcome !== AUDIT_OUTCOMES.SUCCESS,
        ),
      },
    },
  },
);
auditEventSchema.index({ retentionClass: 1, timestamp: 1 });
auditEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const appendOnlyError = () =>
  new Error("AuditEvent is append-only and cannot be modified or deleted");

auditEventSchema.pre("save", function preventResave() {
  if (!this.isNew) throw appendOnlyError();
});

auditEventSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ],
  function preventMutation() {
    throw appendOnlyError();
  },
);

module.exports =
  mongoose.models.AuditEvent ||
  mongoose.model("AuditEvent", auditEventSchema);
