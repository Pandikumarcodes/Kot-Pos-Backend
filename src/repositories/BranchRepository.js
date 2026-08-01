const BaseRepository = require("./BaseRepository");
const Branch = require("../models/Branch");

class BranchRepository extends BaseRepository {
  constructor() {
    super(Branch);
  }

  listWithAdmin() {
    return this.findMany()
      .populate("adminUser", "username role")
      .sort({ createdAt: -1 });
  }

  createBranch(data) {
    return this.create(data);
  }

  updateBranch(id, update) {
    return this.updateById(id, update, { new: true, runValidators: true });
  }

  deactivate(id) {
    return this.updateById(id, { isActive: false }, { new: true });
  }

  findFirstActive() {
    return this.findOne({ isActive: true }).lean();
  }
}

module.exports = new BranchRepository();
module.exports.BranchRepository = BranchRepository;
