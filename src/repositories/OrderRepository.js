const createBaseRepository = require("./BaseRepository");
const TableOrder = require("../models/waiter");
const { leanQuery } = require("./readQuery");
const { directBranchFilter } = require("../utils/operationalOwnership");

const baseRepository = createBaseRepository(TableOrder);

const listTableActive = (filter, options = {}) =>
  baseRepository
    .findMany(filter, undefined, options)
    .populate("createdBy", "username")
    .sort({ createdAt: 1 });
const listTableActiveByAccess = (scope, memberIds, filter = {}, options = {}) =>
  listTableActive(scopedFilter(scope, memberIds, filter), options);

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

const scopedFilter = (scope, memberIds, filter = {}) => ({
  ...directBranchFilter(scope, filter),
});
const listScopedByAccess = ({ scope, memberIds, filter = {}, options = {} } = {}) =>
  listScoped(scopedFilter(scope, memberIds, filter), options);
const countScopedByAccess = ({ scope, memberIds, filter = {}, options = {} } = {}) =>
  baseRepository.count(scopedFilter(scope, memberIds, filter), options);
const findByAccess = (scope, memberIds, filter = {}, options = {}) =>
  baseRepository.findOne(scopedFilter(scope, memberIds, filter), undefined, options);
const findManyByAccess = (scope, memberIds, filter = {}, options = {}) =>
  baseRepository.findMany(scopedFilter(scope, memberIds, filter), undefined, options);
const updateStatusByAccess = (scope, memberIds, filter, status, options = {}) =>
  TableOrder.findOneAndUpdate(scopedFilter(scope, memberIds, filter), { status }, { new: true, ...options });
const updateManyStatusByAccess = (scope, memberIds, filter, status, options = {}) =>
  TableOrder.updateMany(scopedFilter(scope, memberIds, filter), { status }, options);
const updateManyBilledByAccess = (scope, memberIds, filter, billingId, options = {}) =>
  TableOrder.updateMany(
    scopedFilter(scope, memberIds, filter),
    { $set: { billingId } },
    options,
  );

module.exports = {
  ...baseRepository,
  listTableActive,
  listTableActiveByAccess,
  listScoped,
  findScopedWithDetails,
  createOrderDocument,
  createOrder,
  updateStatus,
  updateManyStatus,
  countScoped,
  listScopedByAccess,
  countScopedByAccess,
  findByAccess,
  findManyByAccess,
  updateStatusByAccess,
  updateManyStatusByAccess,
  updateManyBilledByAccess,
};
