const BaseRepository = require("./BaseRepository");
const StockLog = require("../models/StockLog");

class StockLogRepository extends BaseRepository {
  constructor() {
    super(StockLog);
  }

  createLog(data) {
    return this.create(data);
  }

  listForInventory(inventoryId, branchId) {
    return this.findMany({ inventoryId, branchId })
      .populate("doneBy", "username role")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  listLean(filter) {
    return this.findMany(filter).lean();
  }
}

module.exports = new StockLogRepository();
module.exports.StockLogRepository = StockLogRepository;
