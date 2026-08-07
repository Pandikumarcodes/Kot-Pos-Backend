const mongoose = require("mongoose");
const Billing = require("../models/billings");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const TakeAway = require("../models/takeAway");
const Kot = require("../models/kot");
const Branch = require("../models/Branch");
const User = require("../models/users");
const AuditEvent = require("../models/AuditEvent");

const VERSION = "phase5b-1";
const COLLECTIONS = Object.freeze({ Billing, Table, TableOrder, TakeAway });
const COLLECTION_ALIASES = Object.freeze({
  billing: "Billing",
  billings: "Billing",
  table: "Table",
  tables: "Table",
  tableorder: "TableOrder",
  orders: "TableOrder",
  takeaway: "TakeAway",
  takeaways: "TakeAway",
});

const asString = (value) =>
  value === null || value === undefined ? null : String(value);
const isObjectId = (value) => mongoose.isValidObjectId(value);
const normalizeBranchId = (value) => String(value).trim();
const nonNullBranch = (value) =>
  value !== null && value !== undefined && value !== "";
const branchState = (record) =>
  record.branchId === undefined
    ? "missing"
    : record.branchId === null
      ? "null"
      : "present";

const addEvidence = (evidence, source, branchId, referencedIds = []) => {
  if (!nonNullBranch(branchId)) return;
  evidence.push({
    source,
    branchId: asString(branchId),
    referencedIds: referencedIds.filter(Boolean).map(String),
  });
};

const safeErrorMessage = (error) =>
  String(error?.message || "unknown error")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[redacted database URI]")
    .replace(/(password|passwd|pwd)=([^&\s]+)/gi, "$1=[redacted]");

const queryByOptionalReference = async (Model, record, fields, context) => {
  for (const field of fields) {
    if (record[field] && context.findOne) {
      const found = await context.findOne(Model, { _id: record[field] });
      if (found) return { source: field, record: found };
    }
  }
  return null;
};

const resolveOwnership = async (record, collection, context = {}) => {
  const evidence = [];
  const referencedIds = [];
  let missingReference = false;
  let invalidTableMapReason = null;
  const findOne =
    context.findOne || ((Model, filter) => Model.findOne(filter).lean());
  const findAudit =
    context.findAudit ||
    (async (entityType, entityId) =>
      AuditEvent.findOne({
        entityType,
        entityId: String(entityId),
        branchId: { $ne: null },
      })
        .sort({ timestamp: -1 })
        .lean());
  const find = context.findOne ? context.findOne : findOne;

  if (collection === "TakeAway") {
    const mappedBranchId = context.takeawayMap?.[String(record._id)];
    if (mappedBranchId) {
      const validation = await validateBranch(mappedBranchId, context);
      if (!validation.ok) {
        invalidTableMapReason = `takeaway-map assignment rejected: ${validation.error}`;
      } else {
        addEvidence(evidence, "takeaway-map", mappedBranchId, [record._id]);
      }
    }
  }
  if (collection === "Table") {
    if (nonNullBranch(record.branchId))
      addEvidence(evidence, "direct", record.branchId, [record._id]);
  } else {
    if (nonNullBranch(record.branchId))
      addEvidence(evidence, "direct", record.branchId, [record._id]);
    const tableRef = record.tableId
      ? await find(Table, { _id: record.tableId })
      : null;
    if (tableRef) {
      referencedIds.push(record.tableId);
      addEvidence(evidence, "table.branchId", tableRef.branchId, [
        record.tableId,
      ]);
      const mappedBranchId = context.tableMap?.[String(record.tableId)];
      if (mappedBranchId) {
        const validation = await validateBranch(mappedBranchId, context);
        if (!validation.ok) {
          invalidTableMapReason = `table-map assignment rejected: ${validation.error}`;
        } else {
          addEvidence(evidence, "table-map", mappedBranchId, [record.tableId]);
        }
      }
    } else if (record.tableId) {
      referencedIds.push(record.tableId);
      missingReference = true;
    }

    const optionalOrder = await queryByOptionalReference(
      TableOrder,
      record,
      ["orderId", "tableOrderId"],
      { findOne: find },
    );
    if (
      !optionalOrder &&
      ["orderId", "tableOrderId"].some((field) => record[field])
    )
      missingReference = true;
    if (optionalOrder) {
      referencedIds.push(optionalOrder.record._id);
      addEvidence(evidence, "order.branchId", optionalOrder.record.branchId, [
        optionalOrder.record._id,
      ]);
    }
    const optionalKot = await queryByOptionalReference(
      Kot,
      record,
      ["kotId", "KOTId", "kitchenOrderId"],
      { findOne: find },
    );
    if (
      !optionalKot &&
      ["kotId", "KOTId", "kitchenOrderId"].some((field) => record[field])
    )
      missingReference = true;
    if (optionalKot) {
      referencedIds.push(optionalKot.record._id);
      addEvidence(evidence, "kot.branchId", optionalKot.record.branchId, [
        optionalKot.record._id,
      ]);
    }

    if (
      collection === "TakeAway" ||
      collection === "Billing" ||
      collection === "TableOrder"
    ) {
      const audit = await findAudit(collection, record._id);
      if (audit)
        addEvidence(evidence, "audit.branchId", audit.branchId, [record._id]);
    }
    if (record.createdBy) {
      const creator = await find(User, { _id: record.createdBy });
      if (creator) {
        referencedIds.push(record.createdBy);
        addEvidence(evidence, "creator.branchId", creator.branchId, [
          record.createdBy,
        ]);
      }
    }
  }

  const uniqueBranches = [
    ...new Set(
      evidence
        .filter((item) => item.source !== "direct")
        .map((item) => item.branchId),
    ),
  ];
  const directBranch = nonNullBranch(record.branchId)
    ? asString(record.branchId)
    : null;
  const allBranches = [...new Set(evidence.map((item) => item.branchId))];
  const conflicts = allBranches.length > 1 ? evidence : [];
  const candidateBranchId =
    uniqueBranches.length === 1 ? uniqueBranches[0] : null;
  let decision = "unresolved";
  let reason = "no non-conflicting branch evidence";
  if (invalidTableMapReason) {
    decision = "invalid";
    reason = invalidTableMapReason;
  } else if (directBranch) {
    if (!isObjectId(directBranch)) {
      decision = "invalid";
      reason = "current branchId is malformed";
    } else if (conflicts.length) {
      decision = "conflicting";
      reason = "direct branchId conflicts with manual or linked evidence";
    } else {
      decision = "already-owned";
      reason = "direct branchId is authoritative";
    }
  } else if (conflicts.length) {
    decision = "conflicting";
    reason = "authoritative evidence contains multiple branch IDs";
  } else if (collection === "Table") {
    decision = "unresolved";
    reason = "tables require explicit mapping or approved manual default";
  } else if (candidateBranchId) {
    decision = "safe-to-migrate";
    reason = "exactly one branch supported by available evidence";
  }
  if (
    missingReference &&
    !conflicts.length &&
    !context.allowMissingReferences
  ) {
    decision = "orphaned";
    reason = "referenced entity was not found";
  }
  return {
    collection,
    recordId: asString(record._id),
    currentBranchId: directBranch,
    currentBranchState: branchState(record),
    candidateBranchId,
    evidence,
    decision,
    reason,
    conflicts,
    referencedIds: [...new Set(referencedIds.map(String))],
  };
};

const validateBranch = async (branchId, context = {}) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  if (!isObjectId(normalizedBranchId))
    return { ok: false, error: "invalid branch ObjectId" };
  const objectId = new mongoose.Types.ObjectId(normalizedBranchId);
  const found = context.findBranch
    ? await context.findBranch(objectId)
    : await Branch.exists({ _id: objectId });
  return found
    ? { ok: true, branchId: normalizedBranchId }
    : { ok: false, error: "branch does not exist" };
};

const parseTableMap = (fileValue, fsImpl = require("fs")) => {
  if (!fileValue) return {};
  const parsed = JSON.parse(fsImpl.readFileSync(fileValue, "utf8"));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw new Error("table map must be a JSON object");
  const result = {};
  for (const [tableId, branchId] of Object.entries(parsed)) {
    if (!isObjectId(tableId) || !isObjectId(branchId))
      throw new Error(`invalid table mapping: ${tableId}`);
    if (result[tableId]) throw new Error(`duplicate table mapping: ${tableId}`);
    result[tableId] = normalizeBranchId(branchId);
  }
  return result;
};

const parseTakeAwayMap = (fileValue, fsImpl = require("fs")) => {
  if (!fileValue) return {};
  const parsed = JSON.parse(fsImpl.readFileSync(fileValue, "utf8"));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw new Error("takeaway map must be a JSON object");
  const result = {};
  for (const [recordId, branchId] of Object.entries(parsed)) {
    if (!isObjectId(recordId) || (branchId !== null && !isObjectId(branchId)))
      throw new Error(`invalid takeaway mapping: ${recordId}`);
    if (Object.prototype.hasOwnProperty.call(result, recordId)) throw new Error(`duplicate takeaway mapping: ${recordId}`);
    result[recordId] = branchId === null ? null : normalizeBranchId(branchId);
  }
  return result;
};

const chooseTableAssignment = async (decision, options, context) => {
  if (decision.collection !== "Table" || decision.currentBranchId)
    return decision;
  const mapped = options.tableMap?.[decision.recordId];
  let branchId = mapped;
  let source = mapped ? "table-map" : null;
  if (!branchId && options.defaultBranchId) {
    if (!options.confirmDefaultAssignment)
      return {
        ...decision,
        decision: "skipped",
        reason: "default assignment requires --confirm-default-assignment",
      };
    branchId = options.defaultBranchId;
    source = "manual-default";
  }
  if (!branchId) return decision;
  const validation = await validateBranch(branchId, context);
  if (!validation.ok)
    return { ...decision, decision: "invalid", reason: validation.error };
  return {
    ...decision,
    candidateBranchId: String(branchId),
    evidence: [
      {
        source,
        branchId: String(branchId),
        referencedIds: [decision.recordId],
      },
    ],
    decision: "safe-to-migrate",
    reason: source,
  };
};

const getCollection = (value) => {
  const name = COLLECTION_ALIASES[String(value || "").toLowerCase()];
  if (!name) throw new Error(`unknown collection: ${value}`);
  return name;
};

module.exports = {
  VERSION,
  COLLECTIONS,
  COLLECTION_ALIASES,
  resolveOwnership,
  validateBranch,
  parseTableMap,
  parseTakeAwayMap,
  chooseTableAssignment,
  getCollection,
  normalizeBranchId,
  branchState,
  safeErrorMessage,
};
