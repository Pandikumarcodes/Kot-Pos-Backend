const { assertBranchScope } = require("./accessScope");
const { normalizeObjectId } = require("./branchId");
const logger = require("../config/logger");

const logOwnershipViolation = (level, details) => {
  logger[level]("ownership invariant violation", {
    event: "ownership.invariant.violation",
    ...details,
  });
};

const legacyBranchIds = (memberIds = []) =>
  (Array.isArray(memberIds) ? memberIds : []).map(normalizeObjectId).filter(Boolean);

// Direct ownership is authoritative. Creator membership is only a compatibility
// path for records which pre-date direct ownership.
const scopedOwnershipFilter = (scope, memberIds, filter = {}) => {
  const branchId = assertBranchScope(scope).branchId;
  const ids = legacyBranchIds(memberIds);
  if (!ids.length) throw new Error("Branch member scope is required for this operation");
  return {
    $and: [
      filter,
      {
        $or: [
          { branchId },
          { branchId: null },
          { branchId: { $exists: false }, createdBy: { $in: ids } },
        ],
      },
    ],
  };
};

const directBranchFilter = (scope, filter = {}) => ({
  $and: [filter, { branchId: normalizeObjectId(assertBranchScope(scope).branchId) }],
});

const assertSameBranch = (expectedBranchId, actualBranchId, message = "Cross-branch reference") => {
  if (!actualBranchId || String(expectedBranchId) !== String(actualBranchId)) {
    logOwnershipViolation("warn", {
      entityType: "relationship",
      entityId: null,
      expectedBranch: expectedBranchId == null ? null : String(expectedBranchId),
      actualBranch: actualBranchId == null ? null : String(actualBranchId),
      operation: "assertSameBranch",
    });
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
};

const assertBranchIdImmutableUpdate = (update = {}) => {
  const has = (value) => value && Object.prototype.hasOwnProperty.call(value, "branchId");
  if (has(update) || has(update.$set) || has(update.$unset)) {
    logOwnershipViolation("error", {
      entityType: "ownership",
      entityId: update._id == null ? null : String(update._id),
      expectedBranch: null,
      actualBranch: update.branchId || update.$set?.branchId || null,
      operation: "immutable-branchId-update",
    });
    const error = new Error("branchId is immutable after creation");
    error.status = 400;
    throw error;
  }
};

module.exports = {
  legacyBranchIds,
  scopedOwnershipFilter,
  directBranchFilter,
  assertSameBranch,
  assertBranchIdImmutableUpdate,
  logOwnershipViolation,
};
