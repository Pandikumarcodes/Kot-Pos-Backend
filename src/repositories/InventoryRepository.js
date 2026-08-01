const createBaseRepository = require("./BaseRepository");
const Inventory = require("../models/Inventory");

const baseRepository = createBaseRepository(Inventory);

const findActive = (filter, options = {}) => {
  const {
    projection,
    sort = { currentStock: 1 },
    skip = 0,
    limit,
    ...queryOptions
  } = options;
  const query = baseRepository
    .findMany({ ...filter, isActive: true }, projection, queryOptions)
    .populate("menuItemId", "ItemName available")
    .sort(sort)
    .skip(skip);
  if (limit !== undefined) query.limit(limit);
  return query.lean({ virtuals: true });
};

const createInventory = (data, options = {}) =>
  baseRepository.create(data, options);

const updateScoped = (id, branchFilter, update, options = {}) =>
  Inventory.findOneAndUpdate(
    { _id: id, ...branchFilter },
    update,
    { new: true, runValidators: true, ...options },
  );

const findScopedById = (id, branchFilter, options = {}) =>
  baseRepository.findOne({ _id: id, ...branchFilter }, undefined, options);

const deactivateScoped = (id, branchFilter, options = {}) =>
  Inventory.findOneAndUpdate(
    { _id: id, ...branchFilter },
    { isActive: false },
    { new: true, ...options },
  );

const findActiveByMenuItem = (branchId, menuItemId, options = {}) =>
  baseRepository.findOne(
    { branchId, menuItemId, isActive: true },
    undefined,
    options,
  );

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

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
