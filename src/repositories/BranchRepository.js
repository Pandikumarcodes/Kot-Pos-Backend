const createBaseRepository = require("./BaseRepository");
const Branch = require("../models/Branch");

const baseRepository = createBaseRepository(Branch);

const listWithAdmin = () =>
  baseRepository
    .findMany()
    .populate("adminUser", "username role")
    .sort({ createdAt: -1 });

const createBranch = (data) => baseRepository.create(data);

const updateBranch = (id, update) =>
  baseRepository.updateById(id, update, { new: true, runValidators: true });

const deactivate = (id) =>
  baseRepository.updateById(id, { isActive: false }, { new: true });

const findFirstActive = () =>
  baseRepository.findOne({ isActive: true }).lean();

module.exports = {
  ...baseRepository,
  listWithAdmin,
  createBranch,
  updateBranch,
  deactivate,
  findFirstActive,
};
