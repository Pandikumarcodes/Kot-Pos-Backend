const createBaseRepository = require("./BaseRepository");
const Inventory = require("../models/Inventory");

const baseRepository = createBaseRepository(Inventory);

const findActive = (filter) =>
  baseRepository
    .findMany({ ...filter, isActive: true })
    .populate("menuItemId", "ItemName available")
    .sort({ currentStock: 1 })
    .lean({ virtuals: true });

const createInventory = (data) => baseRepository.create(data);

const updateScoped = (id, branchFilter, update) =>
  Inventory.findOneAndUpdate(
    { _id: id, ...branchFilter },
    update,
    { new: true, runValidators: true },
  );

const findScopedById = (id, branchFilter) =>
  baseRepository.findOne({ _id: id, ...branchFilter });

const deactivateScoped = (id, branchFilter) =>
  Inventory.findOneAndUpdate(
    { _id: id, ...branchFilter },
    { isActive: false },
    { new: true },
  );

const findActiveByMenuItem = (branchId, menuItemId) =>
  baseRepository.findOne({ branchId, menuItemId, isActive: true });

const listLean = (filter) => baseRepository.findMany(filter).lean();

module.exports = {
  ...baseRepository,
  findActive,
  createInventory,
  updateScoped,
  findScopedById,
  deactivateScoped,
  findActiveByMenuItem,
  listLean,
};
