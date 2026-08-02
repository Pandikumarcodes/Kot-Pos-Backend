const userRepository = require("./UserRepository");
const { leanQuery } = require("./readQuery");

const findByIdInBranch = (userId, branchId, options = {}) =>
  userRepository.findOne({ _id: userId, branchId }, undefined, options);

const listByBranch = (branchId, options = {}) =>
  leanQuery(userRepository
    .findMany({ branchId }, undefined, options)
    .select("-password")
    .sort({ role: 1 }));

const listUnassigned = (options = {}) =>
  leanQuery(userRepository
    .findMany(
      { branchId: null, role: { $ne: "admin" } },
      undefined,
      options,
    )
    .select("-password")
    .sort({ role: 1 }));

const countActiveByBranch = (branchId, options = {}) =>
  userRepository.count({ branchId, status: "active" }, options);

module.exports = {
  ...userRepository,
  findByIdInBranch,
  listByBranch,
  listUnassigned,
  countActiveByBranch,
};
