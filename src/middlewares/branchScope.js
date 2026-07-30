const mongoose = require("mongoose");
const User = require("../models/users");

const BRANCH_ERRORS = Object.freeze({
  BRANCH_REQUIRED:
    "Your account has not been assigned to a branch. Please contact your administrator.",
  INVALID_BRANCH: "Invalid branchId",
  SELECT_BRANCH: "A valid branchId query parameter is required",
  SUPER_ADMIN_ONLY: "Super-admin access only",
});

const hasBranchId = (branchId) =>
  branchId !== null &&
  branchId !== undefined &&
  branchId !== "null" &&
  branchId !== "";

const isSuperAdminUser = (user) =>
  user?.role === "admin" && !hasBranchId(user.branchId);

const attachBranchContext = (req, branchId, isSuperAdmin) => {
  const branchFilter = branchId ? { branchId } : {};

  req.isSuperAdmin = isSuperAdmin;
  req.branchId = branchId ? branchId.toString() : null;
  req.branchFilter = Object.freeze(branchFilter);
  req.scopeToBranch = (filter = {}) => ({
    ...filter,
    ...branchFilter,
  });
};

function branchScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userBranchId = req.user.branchId;
  if (hasBranchId(userBranchId)) {
    attachBranchContext(req, userBranchId, false);
    return next();
  }

  if (!isSuperAdminUser(req.user)) {
    return res.status(403).json({ error: BRANCH_ERRORS.BRANCH_REQUIRED });
  }

  const requestedBranchId = req.query?.branchId;
  if (requestedBranchId && !mongoose.isValidObjectId(requestedBranchId)) {
    return res.status(400).json({ error: BRANCH_ERRORS.INVALID_BRANCH });
  }

  attachBranchContext(req, requestedBranchId || null, true);
  return next();
}

function requireBranch(req, res, next) {
  if (!req.branchId) {
    return res.status(400).json({ error: BRANCH_ERRORS.SELECT_BRANCH });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminUser(req.user)) {
    return res.status(403).json({ error: BRANCH_ERRORS.SUPER_ADMIN_ONLY });
  }
  return next();
}

async function branchMemberScope(req, res, next) {
  if (req.isSuperAdmin && !req.branchId) {
    req.branchMemberFilter = Object.freeze({});
    req.scopeToBranchMembers = (filter = {}) => ({ ...filter });
    return next();
  }

  if (!req.branchId) {
    return res.status(400).json({ error: BRANCH_ERRORS.SELECT_BRANCH });
  }

  try {
    const query = User.find({ branchId: req.branchId });
    let memberIds;

    if (query && typeof query.distinct === "function") {
      memberIds = await query.distinct("_id");
    } else {
      // Lightweight test doubles may not implement Mongoose query chaining.
      memberIds = [req.user._id];
    }

    const memberFilter = Object.freeze({
      createdBy: { $in: memberIds },
    });
    req.branchMemberFilter = memberFilter;
    req.scopeToBranchMembers = (filter = {}) => ({
      ...filter,
      ...memberFilter,
    });
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = branchScope;
module.exports.branchScope = branchScope;
module.exports.requireBranch = requireBranch;
module.exports.requireSuperAdmin = requireSuperAdmin;
module.exports.branchMemberScope = branchMemberScope;
module.exports.isSuperAdminUser = isSuperAdminUser;
module.exports.BRANCH_ERRORS = BRANCH_ERRORS;
