const createBaseRepository = require("./BaseRepository");
const Customer = require("../models/customer");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(Customer);

const listByLastVisit = (options = {}) => {
  if (!Object.keys(options).length) {
    return leanQuery(baseRepository.findMany({}).sort({ lastVisit: -1 }));
  }
  const { filter = {}, projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions);
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean === false ? query : leanQuery(query);
};

const findByPhone = (phone, options = {}) =>
  leanQuery(baseRepository.findOne({ phone }, { _id: 1 }, options));

const createCustomer = (data, options = {}) =>
  baseRepository.create(data, options);

const updateCustomer = (id, update, options = {}) =>
  baseRepository.updateById(id, update, {
    new: true,
    runValidators: true,
    ...options,
  });

const deleteCustomer = (id, options = {}) =>
  baseRepository.deleteById(id, options);

module.exports = {
  ...baseRepository,
  listByLastVisit,
  findByPhone,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
