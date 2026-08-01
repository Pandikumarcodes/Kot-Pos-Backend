const createBaseRepository = require("./BaseRepository");
const StockLog = require("../models/StockLog");

const baseRepository = createBaseRepository(StockLog);

const createLog = (data, options = {}) => baseRepository.create(data, options);

const listForInventory = (inventoryId, branchId, options = {}) =>
  baseRepository
    .findMany({ inventoryId, branchId }, undefined, options)
    .populate("doneBy", "username role")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

module.exports = {
  ...baseRepository,
  createLog,
  listForInventory,
  listLean,
};
