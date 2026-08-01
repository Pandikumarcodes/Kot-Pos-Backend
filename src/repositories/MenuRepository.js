const createBaseRepository = require("./BaseRepository");
const MenuItem = require("../models/menuItems");

const baseRepository = createBaseRepository(MenuItem);

const findByName = (ItemName, options = {}) =>
  baseRepository.findOne({ ItemName }, undefined, options);

const createMenuDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const listAll = (options = {}) => {
  if (!Object.keys(options).length) {
    return baseRepository.findMany({}).lean();
  }
  const { filter = {}, projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions);
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean ? query.lean() : query;
};

const updateMenuItem = (id, update, options = {}) =>
  baseRepository.updateById(id, update, {
    new: true,
    runValidators: true,
    ...options,
  });

const deleteMenuItem = (id, options = {}) =>
  baseRepository.deleteById(id, options);

const listAvailable = (filter = { available: true }, options = {}) =>
  baseRepository
    .findMany(filter, undefined, options)
    .select("ItemName price category description image available")
    .sort({ category: 1, ItemName: 1 });

const listAvailableLean = (options = {}) =>
  baseRepository.findMany({ available: true }, undefined, options).lean();

const findByIds = (
  ids,
  { availableOnly = false, lean = false, session } = {},
) => {
  const filter = { _id: { $in: ids } };
  if (availableOnly) filter.available = true;
  const query = baseRepository.findMany(
    filter,
    undefined,
    session ? { session } : {},
  );
  return lean && query && typeof query.lean === "function" ? query.lean() : query;
};

const updateAvailability = (id, available, options = {}) =>
  baseRepository.updateById(id, { available }, options);

module.exports = {
  ...baseRepository,
  findByName,
  createMenuDocument,
  listAll,
  updateMenuItem,
  deleteMenuItem,
  listAvailable,
  listAvailableLean,
  findByIds,
  updateAvailability,
};
