const branchRepository = require("../repositories/BranchRepository");
const staffRepository = require("../repositories/StaffRepository");
const settingsRepository = require("../repositories/SettingsRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const AppError = require("../utils/AppError");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const writeFailure = async (values) => {
  try { await administrationAudit.failure(values); } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const listBranches = () => branchRepository.listWithAdmin();

const createBranch = async ({ name, address, phone, email, gstin }, audit = {}) => {
  let context = administrationAudit.createContext(audit);
  let branchId = "branch:pending";
  try {
    const branch = await branchRepository.createBranch({ name, address, phone, email, gstin });
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
  const branch = await branchRepository.updateBranch(id, {
    name,
    address,
    phone,
    email,
    gstin,
    isActive,
  });
  if (!branch) throw new AppError("Branch not found", 404);
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
  if (user.role === "admin" && !user.branchId) {
    throw new AppError("Cannot assign a super-admin to a branch", 400);
  }
  user.branchId = branch._id;
  await staffRepository.save(user, { validateBeforeSave: false });
  return { branch, user };
};

const removeStaff = async (branchId, userId) => {
  const user = await staffRepository.findByIdInBranch(userId, branchId);
  if (!user) throw new AppError("User not found in this branch", 404);
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
  assignStaff,
  removeStaff,
  listBranchStaff,
  listUnassignedStaff,
  getBranchSummary,
};
