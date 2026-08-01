const createBaseRepository = require("./BaseRepository");
const StockLog = require("../models/StockLog");

const baseRepository = createBaseRepository(StockLog);

const createLog = (data) => baseRepository.create(data);

const listForInventory = (inventoryId, branchId) =>
  baseRepository
    .findMany({ inventoryId, branchId })
    .populate("doneBy", "username role")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

const listLean = (filter) => baseRepository.findMany(filter).lean();

module.exports = {
  ...baseRepository,
  createLog,
  listForInventory,
  listLean,
};
