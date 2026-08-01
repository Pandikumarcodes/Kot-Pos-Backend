const Branch = require("../models/Branch");
const User = require("../models/users");
const Settings = require("../models/settings");
const Kot = require("../models/kot");
const AppError = require("../utils/AppError");

const listBranches = () =>
  Branch.find().populate("adminUser", "username role").sort({ createdAt: -1 });

const createBranch = async ({ name, address, phone, email, gstin }) => {
  const branch = await Branch.create({ name, address, phone, email, gstin });
  await Settings.create({ branchId: branch._id, businessName: name, address, phone, gstin });
  return branch;
};

const updateBranch = async (id, input) => {
  const { name, address, phone, email, gstin, isActive } = input;
  const branch = await Branch.findByIdAndUpdate(
    id,
    { name, address, phone, email, gstin, isActive },
    { new: true, runValidators: true },
  );
  if (!branch) throw new AppError("Branch not found", 404);
  return branch;
};

const deactivateBranch = async (id) => {
  const branch = await Branch.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!branch) throw new AppError("Branch not found", 404);
  return branch;
};

const assignStaff = async (branchId, userId) => {
  const [branch, user] = await Promise.all([Branch.findById(branchId), User.findById(userId)]);
  if (!branch) throw new AppError("Branch not found", 404);
  if (!user) throw new AppError("User not found", 404);
  if (user.role === "admin" && !user.branchId) {
    throw new AppError("Cannot assign a super-admin to a branch", 400);
  }
  user.branchId = branch._id;
  await user.save({ validateBeforeSave: false });
  return { branch, user };
};

const removeStaff = async (branchId, userId) => {
  const user = await User.findOne({ _id: userId, branchId });
  if (!user) throw new AppError("User not found in this branch", 404);
  user.branchId = null;
  await user.save({ validateBeforeSave: false });
  return user;
};

const listBranchStaff = (branchId) =>
  User.find({ branchId }).select("-password").sort({ role: 1 });

const listUnassignedStaff = () =>
  User.find({ branchId: null, role: { $ne: "admin" } }).select("-password").sort({ role: 1 });

const getBranchSummary = async (branchId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalOrders, activeOrders, staffCount] = await Promise.all([
    Kot.countDocuments({ branchId, createdAt: { $gte: today } }),
    Kot.countDocuments({ branchId, status: { $in: ["pending", "preparing", "ready"] } }),
    User.countDocuments({ branchId, status: "active" }),
  ]);
  return { totalOrders, activeOrders, staffCount };
};

module.exports = {
  listBranches, createBranch, updateBranch, deactivateBranch, assignStaff,
  removeStaff, listBranchStaff, listUnassignedStaff, getBranchSummary,
};
