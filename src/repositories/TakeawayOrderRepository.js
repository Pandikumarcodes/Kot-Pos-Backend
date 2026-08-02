const createBaseRepository = require("./BaseRepository");
const TakeAway = require("../models/takeAway");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(TakeAway);

const createOrderDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const listScoped = (filter, options = {}) => {
  if (!Object.keys(options).length) {
    return leanQuery(baseRepository.findMany(filter).sort({ createdAt: -1 }));
  }
  const { projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions);
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean === false ? query : leanQuery(query);
};

const findScopedWithDetails = (filter, options = {}) =>
  baseRepository
    .findOne(filter, undefined, options)
    .populate("createdBy", "username")
    .populate("items.itemId", "ItemName price");

const updateStatus = (filter, status, options = {}) =>
  TakeAway.findOneAndUpdate(filter, { status }, { new: true, ...options });

module.exports = {
  ...baseRepository,
  createOrderDocument,
  listScoped,
  findScopedWithDetails,
  updateStatus,
};
