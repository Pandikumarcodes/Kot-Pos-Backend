const createBaseRepository = require("./BaseRepository");
const TableOrder = require("../models/waiter");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(TableOrder);

const listTableActive = (filter, options = {}) =>
  baseRepository
    .findMany(filter, undefined, options)
    .populate("createdBy", "username")
    .sort({ createdAt: 1 });

const listScoped = (filter, options = {}) => {
  if (!Object.keys(options).length) {
    return leanQuery(baseRepository
      .findMany(filter)
      .populate("createdBy", "username")
      .sort({ createdAt: -1 }));
  }
  const { projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions)
    .populate("createdBy", "username");
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

const createOrderDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const createOrder = (data, options = {}) =>
  baseRepository.create(data, options);

const updateStatus = (filter, status, options = {}) =>
  TableOrder.findOneAndUpdate(filter, { status }, { new: true, ...options });

const updateManyStatus = (filter, status, options = {}) =>
  Object.keys(options).length > 0
    ? TableOrder.updateMany(filter, { status }, options)
    : TableOrder.updateMany(filter, { status });

const countScoped = (filter, options = {}) =>
  baseRepository.count(filter, options);

module.exports = {
  ...baseRepository,
  listTableActive,
  listScoped,
  findScopedWithDetails,
  createOrderDocument,
  createOrder,
  updateStatus,
  updateManyStatus,
  countScoped,
};
