const createBaseRepository = require("./BaseRepository");
const Kot = require("../models/kot");
const { leanQuery } = require("./readQuery");
const { branchConstraint } = require("../utils/accessScope");

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

const listScoped = ({ scope, filter = {}, options = {} } = {}) =>
  listActive({ ...filter, ...branchConstraint(scope) }, options);
const countScoped = ({ scope, filter = {}, options = {} } = {}) =>
  baseRepository.count({ ...filter, ...branchConstraint(scope) }, options);
const findByScope = (scope, filter = {}, options = {}) =>
  baseRepository.findOne({ ...filter, ...branchConstraint(scope) }, undefined, options);
const updateStatusByScope = (scope, filter, status, options = {}) =>
  Kot.findOneAndUpdate({ ...filter, ...branchConstraint(scope) }, { status }, { new: true, ...options });
const listLeanScoped = (scope, filter = {}, options = {}) =>
  baseRepository.findMany({ ...filter, ...branchConstraint(scope) }, undefined, options).lean();

module.exports = {
  ...baseRepository,
  listActive,
  findScoped,
  updateStatus,
  createOrder,
  findPublicStatus,
  countByFilter,
  listLean,
  listScoped,
  countScoped,
  findByScope,
  updateStatusByScope,
  listLeanScoped,
};
