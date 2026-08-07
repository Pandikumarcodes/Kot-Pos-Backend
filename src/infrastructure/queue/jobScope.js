const { assertScope, assertBranchScope } = require("../../utils/accessScope");

const serializeScope = (scope) => {
  const valid = assertScope(scope);
  if (valid.type === "branch") {
    assertBranchScope(valid);
    return { type: "branch", isGlobal: false, branchId: String(valid.branchId) };
  }
  return { type: "global", isGlobal: true, branchId: null };
};

const requireJobScope = (data, { allowGlobal = true } = {}) => {
  const scope = serializeScope(data?.scope);
  if (!allowGlobal && scope.type !== "branch") {
    throw new Error("A branch scope is required for this job");
  }
  return scope;
};

module.exports = { serializeScope, requireJobScope };
