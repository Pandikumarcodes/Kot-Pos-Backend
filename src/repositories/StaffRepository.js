const userRepository = require("./UserRepository");

const findByIdInBranch = (userId, branchId) =>
  userRepository.findOne({ _id: userId, branchId });

const listByBranch = (branchId) =>
  userRepository
    .findMany({ branchId })
    .select("-password")
    .sort({ role: 1 });

const listUnassigned = () =>
  userRepository
    .findMany({ branchId: null, role: { $ne: "admin" } })
    .select("-password")
    .sort({ role: 1 });

const countActiveByBranch = (branchId) =>
  userRepository.count({ branchId, status: "active" });

module.exports = {
  ...userRepository,
  findByIdInBranch,
  listByBranch,
  listUnassigned,
  countActiveByBranch,
};
