const userRepository = require("../repositories/UserRepository");
const AppError = require("../utils/AppError");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const writeFailure = async (values) => {
  try {
    await administrationAudit.failure(values);
  } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const createUser = async ({ username, role, password, status }, branchId, audit = {}) => {
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

const listUsers = async (branchFilter) => {
  const users = await userRepository.findByScope(branchFilter);
  if (!users.length) throw new AppError("No users found", 404);
  return users;
};

const updateUserRole = async ({ userId, role, actorRole, scopeToBranch, actorId,
  branchId, correlationId }) => {
  const context = administrationAudit.createContext({ actorId, actorRole, branchId, correlationId });
  let previousRole = null;
  try {
  if (actorRole === "manager" && role === "admin") {
    throw new AppError("Managers cannot assign admin role", 403);
  }
  const previous = await userRepository.findOne(
    scopeToBranch({ _id: userId }),
    "role status branchId username",
  );
  previousRole = previous?.role ?? null;
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

module.exports = { createUser, listUsers, updateUserRole, deleteUser };
