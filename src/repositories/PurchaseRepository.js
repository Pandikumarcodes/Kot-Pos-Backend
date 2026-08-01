const stockLogRepository = require("./StockLogRepository");

const listRestocks = (branchId, filter = {}) =>
  stockLogRepository
    .findMany({ ...filter, branchId, type: "restock" })
    .sort({ createdAt: -1 });

module.exports = {
  ...stockLogRepository,
  listRestocks,
};
