const createBaseRepository = require("./BaseRepository");
const TableOrder = require("../models/waiter");

const baseRepository = createBaseRepository(TableOrder);

const listTableActive = (filter, options = {}) =>
  baseRepository
    .findMany(filter, undefined, options)
    .populate("createdBy", "username")
    .sort({ createdAt: 1 });

const listScoped = (filter, options = {}) =>
  baseRepository
    .findMany(filter, undefined, options)
    .populate("createdBy", "username")
    .sort({ createdAt: -1 });

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
