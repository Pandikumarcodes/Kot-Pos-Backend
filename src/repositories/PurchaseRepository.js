const StockLogRepository = require("./StockLogRepository").StockLogRepository;

class PurchaseRepository extends StockLogRepository {
  listRestocks(branchId, filter = {}) {
    return this.findMany({ ...filter, branchId, type: "restock" })
      .sort({ createdAt: -1 });
  }
}

module.exports = new PurchaseRepository();
module.exports.PurchaseRepository = PurchaseRepository;
