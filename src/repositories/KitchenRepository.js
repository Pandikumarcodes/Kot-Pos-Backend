const createBaseRepository = require("./BaseRepository");
const Kot = require("../models/kot");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(Kot);

const listActive = (filter, options = {}) => {
  if (!Object.keys(options).length) {
    return leanQuery(baseRepository.findMany(filter).sort({ createdAt: 1 }));
  }
  const { projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions);
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean === false ? query : leanQuery(query);
};

const findScoped = (filter, options = {}) =>
  baseRepository.findOne(filter, undefined, options);

const updateStatus = (filter, status, options = {}) =>
  Kot.findOneAndUpdate(filter, { status }, { new: true, ...options });

const createOrder = (data, options = {}) =>
  baseRepository.create(data, options);

const findPublicStatus = (id, options = {}) =>
  baseRepository
    .findById(id, undefined, options)
    .select("status totalAmount items createdAt")
    .lean();

const countByFilter = (filter, options = {}) =>
  baseRepository.count(filter, options);

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

module.exports = {
  ...baseRepository,
  listActive,
  findScoped,
  updateStatus,
  createOrder,
  findPublicStatus,
  countByFilter,
  listLean,
};
