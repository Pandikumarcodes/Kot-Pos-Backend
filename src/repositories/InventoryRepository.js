const createBaseRepository = require("./BaseRepository");
const Inventory = require("../models/Inventory");
const { assertBranchScope, branchConstraint } = require("../utils/accessScope");

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

const listScoped = ({ scope, filter = {}, options = {} } = {}) =>
  findActive({ ...filter, ...branchConstraint(scope) }, options);

const countScoped = ({ scope, filter = {}, options = {} } = {}) =>
  baseRepository.count({ ...filter, ...branchConstraint(scope), isActive: true }, options);

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

const findActiveByMenuItemScoped = (scope, menuItemId, options = {}) =>
  findActiveByMenuItem(branchConstraint(scope).branchId, menuItemId, options);

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

const updateByScope = (id, scope, update, options = {}) =>
  Inventory.findOneAndUpdate({ _id: id, ...branchConstraint(scope) }, update, {
    new: true, runValidators: true, ...options,
  });

const findByScope = (id, scope, options = {}) =>
  baseRepository.findOne({ _id: id, ...branchConstraint(scope) }, undefined, options);

const deactivateByScope = (id, scope, options = {}) =>
  Inventory.findOneAndUpdate({ _id: id, ...branchConstraint(scope) }, { isActive: false }, {
    new: true, ...options,
  });

const listLeanScoped = (scope, filter = {}, options = {}) =>
  baseRepository.findMany({ ...filter, ...branchConstraint(scope) }, undefined, options).lean();

module.exports = {
  ...baseRepository,
  findActive,
  listScoped,
  countScoped,
  createInventory,
  updateScoped,
  findScopedById,
  deactivateScoped,
  findActiveByMenuItem,
  findActiveByMenuItemScoped,
  listLean,
  updateByScope,
  findByScope,
  deactivateByScope,
  listLeanScoped,
};
