const accessScope = require("./accessScope");

// Compatibility middleware: global scope is allowed, but selected-branch
// scope must be opted into explicitly by the route.
const branchScope = accessScope.resolveAccessScope({ allowSelectedBranch: false });

function requireBranch(req, res, next) {
  return accessScope.requireBranchScope(req, res, next);
}

function requireSuperAdmin(req, res, next) {
  if (!accessScope.isGlobalAdmin(req.user)) {
    return res.status(403).json({ error: "Super-admin access only" });
  }
  return next();
}

async function branchMemberScope(req, res, next) {
  return accessScope.loadBranchMembers(req, res, next);
}

module.exports = branchScope;
module.exports.branchScope = branchScope;
module.exports.requireBranch = requireBranch;
module.exports.requireSuperAdmin = requireSuperAdmin;
module.exports.branchMemberScope = branchMemberScope;
module.exports.isSuperAdminUser = accessScope.isGlobalAdmin;
module.exports.BRANCH_ERRORS = accessScope.SCOPE_ERRORS;
module.exports.requireBranchScope = accessScope.requireBranchScope;
module.exports.allowGlobalScope = accessScope.allowGlobalScope;
module.exports.allowGlobalOrSelectedBranch = accessScope.allowGlobalOrSelectedBranch;
module.exports.accessScope = accessScope.accessScope;
