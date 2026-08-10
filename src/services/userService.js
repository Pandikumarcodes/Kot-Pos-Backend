const userRepository = require("../repositories/UserRepository");
const branchRepository = require("../repositories/BranchRepository");
const AppError = require("../utils/AppError");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");
const {
  buildMasterDataPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./masterDataQuery");

const STAFF_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [{ field: "username", mode: "partial" }],
  filters: {
    role: {
      field: "role",
      type: "enum",
      values: ["superadmin", "admin", "manager", "waiter", "chef", "cashier"],
    },
    status: {
      field: "status",
      type: "enum",
      values: ["active", "locked", "accepted"],
    },
  },
  sorting: {
    fields: { name: "username", createdAt: "createdAt" },
    defaultField: "name",
    defaultOrder: "asc",
  },
  fieldSelection: {
    fields: {
      id: "_id",
      username: "username",
      role: "role",
      status: "status",
      branchId: "branchId",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "username", "role", "status", "branchId", "createdAt", "updatedAt",
    ],
  },
});

const writeFailure = async (values) => {
  try {
    await administrationAudit.failure(values);
  } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const ADMIN_PROTECTED_ERROR = "Assigned Branch Admin must be replaced through the Branch Admin lifecycle";
const BRANCH_STAFF_ROLES = new Set(["manager", "waiter", "chef", "cashier"]);

const assertBranchStaffRole = (role, action = "managed") => {
  if (role === "superadmin") {
    throw new AppError("Superadmin cannot be assigned through the staff API", 403);
  }
  if (role === "admin") {
    throw new AppError(`Admin cannot be ${action} through the staff API`, 403);
  }
  if (!BRANCH_STAFF_ROLES.has(role)) {
    throw new AppError("Invalid role", 400);
  }
};

const assertNotAssignedBranchAdmin = async (user, action) => {
  if (!user) return;
  if (user.role !== "admin") return;
  const branch = await branchRepository.findByAdminUser(user._id);
  if (!branch) return;
  throw new AppError(`${ADMIN_PROTECTED_ERROR}; cannot ${action}`, 409);
};

const createUser = async ({ username, role, password, status }, branchId, audit = {}) => {
  const context = administrationAudit.createContext({ ...audit, branchId });
  let staffId = "staff:pending";
  try {
    const requestedRole = role || "waiter";
    assertBranchStaffRole(requestedRole, "created");
    if (await userRepository.findByUsername(username))
      throw new AppError("username already exists", 400);
    const user = await userRepository.createUserDocument({
      username, role: requestedRole, password, status, branchId,
    });
    staffId = user._id;
    await administrationAudit.staffCreated({ context, staff: user });
    return { id: user._id, username: user.username, role: user.role, status: user.status };
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.STAFF_CREATE, context, entityId: staffId, error });
    throw error;
  }
};

const listUsers = async (branchFilter, query = {}) => {
  if (!hasQueryControls(query)) {
    const users = await userRepository.findByScope(branchFilter);
    if (!users.length) throw new AppError("No users found", 404);
    return { items: users };
  }

  const paginated = usesPagination(query);
  const plan = buildMasterDataPlan({
    query,
    policy: STAFF_QUERY_POLICY,
    trustedConstraints: [branchFilter],
  });
  const dataPromise = userRepository.findByScope(
    plan.filter,
    repositoryOptions(plan, paginated),
  );
  const [users, total] = paginated
    ? await Promise.all([dataPromise, userRepository.count(plan.filter)])
    : [await dataPromise, null];
  if (!users.length) throw new AppError("No users found", 404);
  return {
    items: users,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const updateUserRole = async ({ userId, role, actorRole, scopeToBranch, actorId,
  branchId, correlationId }) => {
  const context = administrationAudit.createContext({ actorId, actorRole, branchId, correlationId });
  let previousRole = null;
  try {
  if (actorRole === "manager" && role === "admin") {
    throw new AppError("Managers cannot assign admin role", 403);
  }
  assertBranchStaffRole(role, "assigned");
  const previous = await userRepository.findOne(
    scopeToBranch({ _id: userId }),
    "role status branchId username",
  );
  previousRole = previous?.role ?? null;
  if (previous?.role === "superadmin") {
    throw new AppError("Superadmin cannot be modified through the staff API", 403);
  }
  if (previous?.role === "admin") {
    throw new AppError("Admin cannot be modified through the staff API", 403);
  }
  if (actorRole === "manager" && previous?.role === "admin") {
    throw new AppError("Managers cannot modify admin users", 403);
  }
  await assertNotAssignedBranchAdmin(previous, "change role");
  const user = await userRepository.updateRole(
    scopeToBranch({ _id: userId }),
    role,
  );
  if (!user) throw new AppError("User not found", 404);
  const scopedContext = administrationAudit.createContext({
    actorId, actorRole, branchId: branchId ?? user.branchId, correlationId: context.correlationId,
  });
  await administrationAudit.roleChanged({ context: scopedContext, staffId: user._id,
    previousRole, newRole: user.role });
  return { id: user._id, username: user.username, newRole: user.role };
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.STAFF_ROLE_CHANGE, context, entityId: userId, error });
    throw error;
  }
};

const deleteUser = async (userId, scopeToBranch, audit = {}) => {
  const context = administrationAudit.createContext(audit);
  try {
    const existing = await userRepository.findOne(
      scopeToBranch({ _id: userId }),
      "role status branchId username",
    );
    if (!existing) throw new AppError("User not found", 404);
    if (existing.role === "superadmin") {
      throw new AppError("Superadmin cannot be deleted through the staff API", 403);
    }
    if (existing.role === "admin") {
      throw new AppError("Admin cannot be deleted through the staff API", 403);
    }
    await assertNotAssignedBranchAdmin(existing, "delete");
    const user = await userRepository.deleteByScope(scopeToBranch({ _id: userId }));
    if (!user) throw new AppError("User not found", 404);
    const scopedContext = administrationAudit.createContext({ ...audit,
      branchId: audit.branchId ?? user.branchId, correlationId: context.correlationId });
    await administrationAudit.staffDeleted({ context: scopedContext, staff: user });
    return { id: user._id, username: user.username };
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.STAFF_DELETE, context, entityId: userId, error });
    throw error;
  }
};

module.exports = {
  ADMIN_PROTECTED_ERROR,
  assertBranchStaffRole,
  assertNotAssignedBranchAdmin,
  createUser,
  listUsers,
  updateUserRole,
  deleteUser,
};
