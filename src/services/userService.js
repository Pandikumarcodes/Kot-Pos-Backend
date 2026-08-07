const userRepository = require("../repositories/UserRepository");
const AppError = require("../utils/AppError");
const { assertScope, assertBranchScope } = require("../utils/accessScope");
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
      values: ["admin", "waiter", "chef", "cashier", "manager"],
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

const createUser = async ({ username, role, password, status }, scope, audit = {}) => {
  const branchId = assertBranchScope(scope).branchId;
  const context = administrationAudit.createContext({ ...audit, branchId });
  let staffId = "staff:pending";
  try {
    if (await userRepository.findByUsername(username))
      throw new AppError("username already exists", 400);
    const user = await userRepository.createUserDocument({
      username, role, password, status, branchId,
    });
    staffId = user._id;
    await administrationAudit.staffCreated({ context, staff: user });
    return { id: user._id, username: user.username, role: user.role, status: user.status };
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.STAFF_CREATE, context, entityId: staffId, error });
    throw error;
  }
};

const scopeFilter = (scope) => {
  assertScope(scope);
  return scope.type === "global" ? {} : { branchId: scope.branchId };
};

const listUsers = async (scope, query = {}) => {
  const branchFilter = scopeFilter(scope);
  if (!hasQueryControls(query)) {
    const users = await userRepository.findByAccess({ scope });
    if (!users.length) throw new AppError("No users found", 404);
    return { items: users };
  }

  const paginated = usesPagination(query);
  const plan = buildMasterDataPlan({
    query,
    policy: STAFF_QUERY_POLICY,
    trustedConstraints: [branchFilter],
  });
  const dataPromise = userRepository.findByAccess({
    scope,
    filter: plan.filter,
    options: repositoryOptions(plan, paginated),
  });
  const [users, total] = paginated
    ? await Promise.all([
      dataPromise,
      userRepository.countByAccess(scope, plan.filter),
    ])
    : [await dataPromise, null];
  if (!users.length) throw new AppError("No users found", 404);
  return {
    items: users,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const updateUserRole = async ({ userId, role, actorRole, scope, actorId,
  branchId, correlationId }) => {
  const filter = scopeFilter(scope);
  const context = administrationAudit.createContext({ actorId, actorRole, branchId, correlationId });
  let previousRole = null;
  try {
  if (actorRole === "manager" && role === "admin") {
    throw new AppError("Managers cannot assign admin role", 403);
  }
  const previous = await userRepository.findOneByAccess(
    scope, { _id: userId }, { projection: "role status branchId username" },
  );
  previousRole = previous?.role ?? null;
  const user = await userRepository.updateRoleByAccess(scope, { _id: userId }, role);
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

const deleteUser = async (userId, scope, audit = {}) => {
  const filter = scopeFilter(scope);
  const context = administrationAudit.createContext(audit);
  try {
    const user = await userRepository.deleteByAccess(scope, { _id: userId });
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

module.exports = { createUser, listUsers, updateUserRole, deleteUser };
