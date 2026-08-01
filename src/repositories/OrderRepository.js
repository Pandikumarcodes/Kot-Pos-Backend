const createBaseRepository = require("./BaseRepository");
const TableOrder = require("../models/waiter");

const baseRepository = createBaseRepository(TableOrder);

const listTableActive = (filter) =>
  baseRepository
    .findMany(filter)
    .populate("createdBy", "username")
    .sort({ createdAt: 1 });

const listScoped = (filter) =>
  baseRepository
    .findMany(filter)
    .populate("createdBy", "username")
    .sort({ createdAt: -1 });

const findScopedWithDetails = (filter) =>
  baseRepository
    .findOne(filter)
    .populate("createdBy", "username")
    .populate("items.itemId", "ItemName price");

const createOrderDocument = (data) => baseRepository.createDocument(data);

const createOrder = (data) => baseRepository.create(data);

const updateStatus = (filter, status) =>
  TableOrder.findOneAndUpdate(filter, { status }, { new: true });

const updateManyStatus = (filter, status) =>
  TableOrder.updateMany(filter, { status });

const countScoped = (filter) => baseRepository.count(filter);

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
