const stockLogRepository = require("./StockLogRepository");

const listRestocks = (branchId, filter = {}, options = {}) =>
  stockLogRepository
    .findMany({ ...filter, branchId, type: "restock" }, undefined, options)
    .sort({ createdAt: -1 });

module.exports = {
  ...stockLogRepository,
  listRestocks,
};
