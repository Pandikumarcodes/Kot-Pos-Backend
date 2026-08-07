const createBaseRepository = require("./BaseRepository");
const Branch = require("../models/Branch");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(Branch);

const listWithAdmin = (options = {}) =>
  leanQuery(
    baseRepository
      .findMany({}, undefined, options)
      .populate("adminUser", "username role")
      .sort({ createdAt: -1 }),
  );

const createBranch = (data, options = {}) =>
  baseRepository.create(data, options);

const updateBranch = (id, update, options = {}) =>
  baseRepository.updateById(id, update, {
    new: true,
    runValidators: true,
    ...options,
  });

const deactivate = (id, options = {}) =>
  baseRepository.updateById(id, { isActive: false }, { new: true, ...options });

const findFirstActive = (options = {}) =>
  baseRepository.findOne({ isActive: true }, undefined, options).lean();

module.exports = {
  ...baseRepository,
  listWithAdmin,
  createBranch,
  updateBranch,
  deactivate,
  findFirstActive,
};
