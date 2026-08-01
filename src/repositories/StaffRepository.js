const UserRepository = require("./UserRepository").UserRepository;

class StaffRepository extends UserRepository {
  findByIdInBranch(userId, branchId) {
    return this.findOne({ _id: userId, branchId });
  }

  listByBranch(branchId) {
    return this.findMany({ branchId }).select("-password").sort({ role: 1 });
  }

  listUnassigned() {
    return this.findMany({ branchId: null, role: { $ne: "admin" } })
      .select("-password")
      .sort({ role: 1 });
  }

  countActiveByBranch(branchId) {
    return this.count({ branchId, status: "active" });
  }
}

module.exports = new StaffRepository();
module.exports.StaffRepository = StaffRepository;
