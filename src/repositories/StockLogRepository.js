const createBaseRepository = require("./BaseRepository");
const StockLog = require("../models/StockLog");

const baseRepository = createBaseRepository(StockLog);

const createLog = (data, options = {}) => baseRepository.create(data, options);

const listForInventory = (inventoryId, branchId, options = {}) => {
  if (!Object.keys(options).length) {
    return baseRepository
      .findMany({ inventoryId, branchId })
      .populate("doneBy", "username role")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }
  const {
    filter = { inventoryId, branchId },
    projection,
    sort,
    skip,
    limit,
    lean,
    ...queryOptions
  } = options;
  let query = baseRepository
    .findMany(filter, projection, queryOptions)
    .populate("doneBy", "username role");
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean ? query.lean() : query;
};

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

module.exports = {
  ...baseRepository,
  createLog,
  listForInventory,
  listLean,
};
