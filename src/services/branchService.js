const branchRepository = require("../repositories/BranchRepository");
const staffRepository = require("../repositories/StaffRepository");
const userRepository = require("../repositories/UserRepository");
const settingsRepository = require("../repositories/SettingsRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const transactionManager = new TransactionManager();
const OLD_ADMIN_REPLACEMENT_ROLE = "manager";

const writeFailure = async (values) => {
  try { await administrationAudit.failure(values); } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const listBranches = () => branchRepository.listWithAdmin();

const sameId = (left, right) =>
  left !== null &&
  left !== undefined &&
  right !== null &&
  right !== undefined &&
  String(left) === String(right);

const assertEligibleBranchAdmin = (candidate, branchId) => {
  if (!candidate) throw new AppError("Candidate user not found", 404);
  if (candidate.role === "superadmin") {
    throw new AppError("Superadmin cannot be assigned as Branch Admin", 403);
  }
  if (candidate.status && candidate.status !== "active") {
    throw new AppError("Candidate user must be active", 409);
  }
  if (candidate.role === "admin" && !sameId(candidate.branchId, branchId)) {
    throw new AppError("Candidate is already an admin of another branch", 409);
  }
  if (candidate.branchId && !sameId(candidate.branchId, branchId)) {
    throw new AppError("Candidate is assigned to another branch", 409);
  }
};

const loadCurrentBranchAdmin = async (branch, session) => {
  const assigned = branch.adminUser
    ? await userRepository.findById(branch.adminUser, undefined, { session })
    : null;
  const branchRoleAdmin = await userRepository.findBranchAdmin(branch._id, { session });

  if (assigned && branchRoleAdmin && !sameId(assigned._id, branchRoleAdmin._id)) {
    throw new AppError("Branch adminUser does not match branch role admin", 409);
  }
  return assigned || branchRoleAdmin;
};

const assertActivationAdminInvariant = async (branch, session) => {
  if (!branch.adminUser) {
    throw new AppError("Branch Admin must be assigned before activating branch", 409);
  }

  const assigned = await userRepository.findById(branch.adminUser, undefined, { session });
  if (!assigned) {
    throw new AppError("Branch Admin relationship is invalid", 409);
  }
  if (assigned.role !== "admin" || !sameId(assigned.branchId, branch._id)) {
    throw new AppError("Branch Admin relationship is invalid", 409);
  }

  const branchRoleAdmin = await userRepository.findBranchAdmin(branch._id, { session });
  if (branchRoleAdmin && !sameId(branchRoleAdmin._id, assigned._id)) {
    throw new AppError("Branch adminUser does not match branch role admin", 409);
  }
};

const assignBranchAdmin = async ({ branchId, userId }, audit = {}) => {
  const context = administrationAudit.createContext({ ...audit, branchId });
  try {
    return await transactionManager.execute(async (session) => {
      const branch = await branchRepository.findById(branchId, undefined, { session });
      if (!branch) throw new AppError("Branch not found", 404);

      const currentAdmin = await loadCurrentBranchAdmin(branch, session);
      const candidate = await userRepository.findById(userId, undefined, { session });
      assertEligibleBranchAdmin(candidate, branch._id);

      if (currentAdmin && sameId(currentAdmin._id, candidate._id)) {
        candidate.role = "admin";
        candidate.branchId = branch._id;
        branch.adminUser = candidate._id;
        await staffRepository.save(candidate, { session, validateBeforeSave: false });
        await branchRepository.save(branch, { session, validateBeforeSave: false });
        return { branch, user: candidate, previousAdmin: currentAdmin, replaced: false };
      }

      if (currentAdmin) {
        currentAdmin.role = OLD_ADMIN_REPLACEMENT_ROLE;
        currentAdmin.branchId = branch._id;
        await userRepository.clearRefreshToken(currentAdmin._id, { session });
        await staffRepository.save(currentAdmin, { session, validateBeforeSave: false });
      }

      candidate.role = "admin";
      candidate.branchId = branch._id;
      await userRepository.clearRefreshToken(candidate._id, { session });
      await staffRepository.save(candidate, { session, validateBeforeSave: false });

      branch.adminUser = candidate._id;
      await branchRepository.save(branch, { session, validateBeforeSave: false });

      if (currentAdmin) {
        await administrationAudit.branchAdminReplaced({
          context,
          branchId: branch._id,
          previousAdmin: currentAdmin,
          newAdmin: candidate,
        }, { session });
      } else {
        await administrationAudit.branchAdminAssigned({
          context,
          branchId: branch._id,
          newAdmin: candidate,
        }, { session });
      }
      return {
        branch,
        user: candidate,
        previousAdmin: currentAdmin,
        replaced: Boolean(currentAdmin),
      };
    });
  } catch (error) {
    await writeFailure({
      action: AUDIT_ACTIONS.BRANCH_ADMIN_ASSIGN,
      context,
      entityId: branchId,
      error,
    });
    throw error;
  }
};

const createBranchAdmin = async ({ branchId, username, password, status = "active" }, audit = {}) => {
  const context = administrationAudit.createContext({ ...audit, branchId });
  let newAdminId = "branch-admin:pending";
  try {
    return await transactionManager.execute(async (session) => {
      const branch = await branchRepository.findById(branchId, undefined, { session });
      if (!branch) throw new AppError("Branch not found", 404);

      const currentAdmin = await loadCurrentBranchAdmin(branch, session);
      if (await userRepository.findByUsername(username, undefined, { session })) {
        throw new AppError("username already exists", 400);
      }

      if (currentAdmin) {
        currentAdmin.role = OLD_ADMIN_REPLACEMENT_ROLE;
        currentAdmin.branchId = branch._id;
        await userRepository.clearRefreshToken(currentAdmin._id, { session });
        await staffRepository.save(currentAdmin, { session, validateBeforeSave: false });
      }

      const user = await userRepository.createUserDocument({
        username,
        password,
        status,
        role: "admin",
        branchId: branch._id,
      }, { session });
      newAdminId = user._id;

      branch.adminUser = user._id;
      await branchRepository.save(branch, { session, validateBeforeSave: false });

      if (currentAdmin) {
        await administrationAudit.branchAdminReplaced({
          context,
          branchId: branch._id,
          previousAdmin: currentAdmin,
          newAdmin: user,
        }, { session });
      } else {
        await administrationAudit.branchAdminAssigned({
          context,
          branchId: branch._id,
          newAdmin: user,
        }, { session });
      }

      return {
        branch,
        user,
        previousAdmin: currentAdmin,
        replaced: Boolean(currentAdmin),
      };
    });
  } catch (error) {
    await writeFailure({
      action: AUDIT_ACTIONS.BRANCH_ADMIN_ASSIGN,
      context,
      entityId: newAdminId,
      error,
    });
    throw error;
  }
};

const createBranch = async ({ name, address, phone, email, gstin }, audit = {}) => {
  let context = administrationAudit.createContext(audit);
  let branchId = "branch:pending";
  try {
    const branch = await branchRepository.createBranch({
      name,
      address,
      phone,
      email,
      gstin,
      isActive: false,
    });
    branchId = branch._id;
    await settingsRepository.createSettings({ branchId: branch._id,
      businessName: name, address, phone, gstin });
    context = administrationAudit.createContext({ ...audit, branchId,
      correlationId: context.correlationId });
    await administrationAudit.branchCreated({ context, branch });
    return branch;
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.BRANCH_CREATE, context, entityId: branchId, error });
    throw error;
  }
};

const updateBranch = async (id, input, audit = {}) => {
  const context = administrationAudit.createContext({ ...audit, branchId: id });
  try {
  const { name, address, phone, email, gstin, isActive } = input;
  const previous = await branchRepository.findById(id);
  if (!previous) throw new AppError("Branch not found", 404);
  if (isActive === true) {
    await assertActivationAdminInvariant(previous);
  }
  const branch = await branchRepository.updateBranch(id, {
    name,
    address,
    phone,
    email,
    gstin,
    isActive,
  });
  await administrationAudit.branchUpdated({ context, branchId: id,
    before: previous, after: branch });
  return branch;
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.BRANCH_UPDATE, context, entityId: id, error });
    throw error;
  }
};

const deactivateBranch = async (id, audit = {}) => {
  const context = administrationAudit.createContext({ ...audit, branchId: id });
  try {
    const previous = await branchRepository.findById(id);
    const branch = await branchRepository.deactivate(id);
    if (!branch) throw new AppError("Branch not found", 404);
    await administrationAudit.branchDeleted({ context, branch,
      previousActive: previous?.isActive ?? true });
    return branch;
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.BRANCH_DELETE, context, entityId: id, error });
    throw error;
  }
};

const assignStaff = async (branchId, userId) => {
  const [branch, user] = await Promise.all([
    branchRepository.findById(branchId),
    staffRepository.findById(userId),
  ]);
  if (!branch) throw new AppError("Branch not found", 404);
  if (!user) throw new AppError("User not found", 404);
  if (user.role === "superadmin") {
    throw new AppError("Cannot assign a super-admin to a branch", 400);
  }
  if (user.role === "admin") {
    throw new AppError("Admin users must be assigned through the Branch Admin lifecycle", 409);
  }
  user.branchId = branch._id;
  await staffRepository.save(user, { validateBeforeSave: false });
  return { branch, user };
};

const removeStaff = async (branchId, userId) => {
  const user = await staffRepository.findByIdInBranch(userId, branchId);
  if (!user) throw new AppError("User not found in this branch", 404);
  if (user.role === "admin") {
    throw new AppError("Admin users must be removed through Branch Admin replacement", 409);
  }
  const branch = await branchRepository.findByAdminUser(user._id);
  if (branch) {
    throw new AppError("Assigned Branch Admin must be replaced before removing from branch", 409);
  }
  user.branchId = null;
  await staffRepository.save(user, { validateBeforeSave: false });
  return user;
};

const listBranchStaff = (branchId) => staffRepository.listByBranch(branchId);

const listUnassignedStaff = () => staffRepository.listUnassigned();

const getBranchSummary = async (branchId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalOrders, activeOrders, staffCount] = await Promise.all([
    kitchenRepository.countByFilter({ branchId, createdAt: { $gte: today } }),
    kitchenRepository.countByFilter({
      branchId,
      status: { $in: ["pending", "preparing", "ready"] },
    }),
    staffRepository.countActiveByBranch(branchId),
  ]);
  return { totalOrders, activeOrders, staffCount };
};

module.exports = {
  listBranches,
  createBranch,
  updateBranch,
  deactivateBranch,
  assignBranchAdmin,
  createBranchAdmin,
  assignStaff,
  removeStaff,
  listBranchStaff,
  listUnassignedStaff,
  getBranchSummary,
  OLD_ADMIN_REPLACEMENT_ROLE,
};
