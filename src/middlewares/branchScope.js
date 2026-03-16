const mongoose = require("mongoose");

module.exports = function branchScope(req, res, next) {
  const userBranchId = req.user?.branchId ?? null;

  if (!userBranchId) {
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
    req.isSuperAdmin = false;
    req.branchId = userBranchId.toString();
    req.branchFilter = { branchId: userBranchId };
  }

  next();
};
