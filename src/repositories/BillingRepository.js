const createBaseRepository = require("./BaseRepository");
const Billing = require("../models/billings");

const baseRepository = createBaseRepository(Billing);

const countCreatedSince = (date, options = {}) =>
  baseRepository.count({ createdAt: { $gte: date } }, options);

const createBillDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const createBill = (data, options = {}) => baseRepository.create(data, options);

const listScoped = (filter, options = {}) => {
  if (!Object.keys(options).length) {
    return baseRepository.findMany(filter).populate("createdBy", "username role").sort({ createdAt: -1 });
  }
  const { projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions)
    .populate("createdBy", "username role");
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean ? query.lean() : query;
};

const findScopedWithCreator = (filter, options = {}) =>
  baseRepository
    .findOne(filter, undefined, options)
    .populate("createdBy", "username role");

const findScoped = (filter, options = {}) =>
  baseRepository.findOne(filter, undefined, options);

const deleteScoped = (filter, options = {}) =>
  baseRepository.deleteOne(filter, options);

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

module.exports = {
  ...baseRepository,
  countCreatedSince,
  createBillDocument,
  createBill,
  listScoped,
  findScopedWithCreator,
  findScoped,
  deleteScoped,
  listLean,
};
