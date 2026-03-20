const mongoose = require("mongoose");
const BRANCH_EXEMPT_ROLES = ["admin"];

module.exports = function branchScope(req, res, next) {
  const userBranchId = req.user?.branchId ?? null;
  const userRole = req.user?.role;

  const hasBranchId =
    userBranchId !== null &&
    userBranchId !== undefined &&
    userBranchId !== "null" &&
    userBranchId !== "";

  if (!hasBranchId) {
    // Only admin with no branchId is a super-admin
    if (BRANCH_EXEMPT_ROLES.includes(userRole)) {
      req.isSuperAdmin = true;

      const queryBranch = req.query.branchId;
      if (queryBranch && mongoose.isValidObjectId(queryBranch)) {
        req.branchId = queryBranch;
        req.branchFilter = { branchId: queryBranch };
      } else {
        req.branchId = null;
        req.branchFilter = {};
      }
    } else {
      return res.status(403).json({
        error:
          "Your account has not been assigned to a branch. Please contact your administrator.",
      });
    }
  } else {
    req.isSuperAdmin = false;
    req.branchId = userBranchId.toString();
    req.branchFilter = { branchId: userBranchId };
  }

  next();
};
