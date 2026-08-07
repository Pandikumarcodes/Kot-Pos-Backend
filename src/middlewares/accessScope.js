const User = require("../models/users");
const { normalizeBranchId, normalizeObjectId } = require("../utils/branchId");

const SCOPE_ERRORS = Object.freeze({
  AUTHENTICATION_REQUIRED: "Not authenticated",
  BRANCH_REQUIRED:
    "Your account has not been assigned to a branch. Please contact your administrator.",
  INVALID_BRANCH: "Invalid branchId",
  SELECT_BRANCH: "A valid branchId query parameter is required",
  BRANCH_SCOPE_REQUIRED: "A branch scope is required for this operation",
});

const hasBranchId = (value) =>
  value !== null && value !== undefined && value !== "" && value !== "null";

const normalizedRole = (user) =>
  String(user?.role || "").trim().toLowerCase();

const isGlobalAdmin = (user) =>
  normalizedRole(user) === "admin" && !hasBranchId(user?.branchId);

const makeScope = (branchId) => {
  if (branchId) {
    return Object.freeze({ type: "branch", isGlobal: false, branchId });
  }
  return Object.freeze({ type: "global", isGlobal: true, branchId: null });
};

const validateScope = (scope) => {
  if (!scope || !["global", "branch"].includes(scope.type)) {
    throw new Error("Invalid access scope");
  }
  if (scope.type === "branch" && !scope.branchId) {
    throw new Error("Branch scope requires branchId");
  }
  if (scope.type === "global" && scope.branchId !== null) {
    throw new Error("Global scope cannot contain branchId");
  }
  return scope;
};

const attachCompatibility = (req, scope) => {
  req.accessScope = scope;
};

const resolveAccessScope = ({ allowSelectedBranch = false } = {}) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: SCOPE_ERRORS.AUTHENTICATION_REQUIRED });
    }

    const requested = req.query?.branchId;
    let requestedBranchId = null;
    if (requested !== undefined) {
      try {
        requestedBranchId = normalizeBranchId(requested);
      } catch (_error) {
        return res.status(400).json({ error: SCOPE_ERRORS.INVALID_BRANCH });
      }
    }

    const assigned = req.user.branchId;
    if (hasBranchId(assigned)) {
      let assignedBranchId;
      try {
        assignedBranchId = normalizeBranchId(assigned);
      } catch (_error) {
        return res.status(400).json({ error: SCOPE_ERRORS.INVALID_BRANCH });
      }
      if (requestedBranchId && requestedBranchId !== assignedBranchId) {
        return res.status(403).json({ error: SCOPE_ERRORS.BRANCH_REQUIRED });
      }
      attachCompatibility(req, makeScope(assignedBranchId));
      return next();
    }

    if (!isGlobalAdmin(req.user)) {
      return res.status(403).json({ error: SCOPE_ERRORS.BRANCH_REQUIRED });
    }

    if (requestedBranchId && !allowSelectedBranch) {
      return res.status(403).json({ error: SCOPE_ERRORS.SELECT_BRANCH });
    }

    attachCompatibility(req, requestedBranchId ? makeScope(requestedBranchId) : makeScope(null));
    return next();
  };

const requireBranchScope = (req, res, next) => {
  if (req.accessScope?.type !== "branch" || !req.accessScope.branchId) {
    return res.status(403).json({ error: SCOPE_ERRORS.BRANCH_SCOPE_REQUIRED });
  }
  return next();
};

const allowGlobalScope = (req, res, next) => {
  if (!req.accessScope) {
    return res.status(403).json({ error: SCOPE_ERRORS.BRANCH_SCOPE_REQUIRED });
  }
  return next();
};

const allowGlobalOrSelectedBranch = resolveAccessScope({ allowSelectedBranch: true });

const loadBranchMembers = async (req, res, next) => {
  if (req.accessScope?.type !== "branch") {
    req.branchMemberIds = null;
    return next();
  }
  try {
    const query = User.find({ branchId: req.accessScope.branchId });
    const members = query && typeof query.lean === "function"
      ? await query.lean()
      : query && typeof query.exec === "function"
        ? await query.exec()
        : Array.isArray(query)
          ? query
          : [req.user];
    const memberIds = (Array.isArray(members) ? members : [])
      .map(normalizeObjectId)
      .filter(Boolean);
    req.branchMemberIds = memberIds;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  SCOPE_ERRORS,
  hasBranchId,
  isGlobalAdmin,
  makeScope,
  validateScope,
  resolveAccessScope,
  accessScope: resolveAccessScope,
  requireBranchScope,
  allowGlobalScope,
  allowGlobalOrSelectedBranch,
  loadBranchMembers,
};
