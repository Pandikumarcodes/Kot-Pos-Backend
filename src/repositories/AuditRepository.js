const mongoose = require("mongoose");
const AuditEvent = require("../models/AuditEvent");
const AuditValidationError = require("../infrastructure/audit/errors/AuditValidationError");
const { AUDIT_ACTION_VALUES } = require("../infrastructure/audit/auditActions");
const {
  ACTOR_TYPES,
  AUDIT_LEVELS,
  AUDIT_OUTCOMES,
  ENTITY_TYPES,
  RETENTION_CLASSES,
  enumValues,
} = require("../infrastructure/audit/auditEnums");

const MAX_SEARCH_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 50;

const withSession = (session) => (session ? { session } : {});
const validDate = (value, name) => {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AuditValidationError(`${name} must be a valid date`);
  }
  return date;
};

const assertEnum = (value, enumeration, name) => {
  if (value !== undefined && !enumValues(enumeration).includes(value)) {
    throw new AuditValidationError(`${name} is invalid`);
  }
};

const buildFilter = (filters = {}) => {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new AuditValidationError("Audit search filters must be an object");
  }
  assertEnum(filters.actorType, ACTOR_TYPES, "actorType");
  assertEnum(filters.entityType, ENTITY_TYPES, "entityType");
  assertEnum(filters.level, AUDIT_LEVELS, "level");
  assertEnum(filters.outcome, AUDIT_OUTCOMES, "outcome");
  assertEnum(filters.retentionClass, RETENTION_CLASSES, "retentionClass");
  if (filters.action && !AUDIT_ACTION_VALUES.includes(filters.action)) {
    throw new AuditValidationError("action is invalid");
  }

  const query = {};
  for (const key of [
    "eventId",
    "actor",
    "actorRole",
    "actorType",
    "branchId",
    "entityType",
    "entityId",
    "action",
    "level",
    "retentionClass",
    "outcome",
    "correlationId",
    "transactionId",
  ]) {
    if (filters[key] !== undefined && filters[key] !== null) {
      query[key] = filters[key];
    }
  }
  const from = validDate(filters.from, "from");
  const to = validDate(filters.to, "to");
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = from;
    if (to) query.timestamp.$lte = to;
  }
  return query;
};

const insert = async (event, { session } = {}) => {
  if (!event || typeof event !== "object") {
    throw new AuditValidationError("Audit event is required");
  }
  if (session) {
    const [document] = await AuditEvent.create([event], { session });
    return document;
  }
  return AuditEvent.create(event);
};

const insertMany = (events, { session } = {}) => {
  if (!Array.isArray(events) || !events.length) {
    throw new AuditValidationError("Audit events are required");
  }
  return AuditEvent.insertMany(events, {
    ordered: true,
    ...withSession(session),
  });
};

const findByEventId = (eventId, { session } = {}) => {
  if (typeof eventId !== "string" || !eventId) {
    throw new AuditValidationError("eventId is required");
  }
  return AuditEvent.findOne(
    { eventId },
    undefined,
    withSession(session),
  ).lean();
};

const search = (
  filters = {},
  { limit = DEFAULT_SEARCH_LIMIT, cursor = null, session, projection } = {},
) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    throw new AuditValidationError(
      `Audit search limit must be between 1 and ${MAX_SEARCH_LIMIT}`,
    );
  }
  const query = buildFilter(filters);
  if (cursor) {
    const cursorDate = validDate(cursor.timestamp, "cursor.timestamp");
    if (!cursorDate || !mongoose.isValidObjectId(cursor.id)) {
      throw new AuditValidationError("Audit search cursor is invalid");
    }
    const cursorId = new mongoose.Types.ObjectId(cursor.id);
    query.$and = [
      {
        $or: [
          { timestamp: { $lt: cursorDate } },
          { timestamp: cursorDate, _id: { $lt: cursorId } },
        ],
      },
    ];
  }
  return AuditEvent.find(
    query,
    projection,
    withSession(session),
  )
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit)
    .lean();
};

const streamForArchive = (
  filters = {},
  { session, batchSize = 500 } = {},
) => {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new AuditValidationError("Archive batchSize is invalid");
  }
  return AuditEvent.find(
    buildFilter(filters),
    undefined,
    withSession(session),
  )
    .sort({ timestamp: 1, _id: 1 })
    .lean()
    .cursor({ batchSize });
};

const countForRetention = (
  { retentionClass, before },
  { session } = {},
) => {
  assertEnum(retentionClass, RETENTION_CLASSES, "retentionClass");
  if (!retentionClass) {
    throw new AuditValidationError("retentionClass is required");
  }
  const cutoff = validDate(before, "before");
  if (!cutoff) throw new AuditValidationError("before is required");
  return AuditEvent.countDocuments(
    { retentionClass, timestamp: { $lt: cutoff } },
    withSession(session),
  );
};

module.exports = {
  insert,
  insertMany,
  findByEventId,
  search,
  streamForArchive,
  countForRetention,
};
