const AppError = require("./AppError");

const isValidBranchId = (value) =>
  value !== null && value !== undefined && value !== "" && value !== "null" && value !== "undefined";

const assertScope = (scope) => {
  if (!scope || !["global", "branch"].includes(scope.type)) {
    throw new AppError("A valid access scope is required", 403);
  }
  if (scope.type === "branch" && !isValidBranchId(scope.branchId)) {
    throw new AppError("A branch scope is required for this operation", 403);
  }
  if (scope.type === "global" && scope.branchId !== null) {
    throw new AppError("Global scope cannot contain branchId", 403);
  }
  if (scope.isGlobal !== (scope.type === "global")) {
    throw new AppError("Access scope isGlobal flag is invalid", 403);
  }
  return scope;
};

const assertBranchScope = (scope) => {
  const valid = assertScope(scope);
  if (valid.type !== "branch") {
    throw new AppError("A branch scope is required for this operation", 403);
  }
  return valid;
};

const branchConstraint = (scope) => ({
  branchId: assertBranchScope(scope).branchId,
});

const memberConstraint = (scope, memberIds) => {
  const ids = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];
  if (!ids.length) {
    throw new AppError("Branch member scope is required for this operation", 403);
  }
  return { createdBy: { $in: ids } };
};

module.exports = { assertScope, assertBranchScope, branchConstraint, memberConstraint };
