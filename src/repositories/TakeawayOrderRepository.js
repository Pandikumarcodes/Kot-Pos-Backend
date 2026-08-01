const BaseRepository = require("./BaseRepository");
const TakeAway = require("../models/takeAway");

class TakeawayOrderRepository extends BaseRepository {
  constructor() {
    super(TakeAway);
  }

  createOrderDocument(data) {
    return this.createDocument(data);
  }

  listScoped(filter) {
    return this.findMany(filter).sort({ createdAt: -1 });
  }

  findScopedWithDetails(filter) {
    return this.findOne(filter)
      .populate("createdBy", "username")
      .populate("items.itemId", "ItemName price");
  }

  updateStatus(filter, status) {
    return this.model.findOneAndUpdate(filter, { status }, { new: true });
  }
}

module.exports = new TakeawayOrderRepository();
module.exports.TakeawayOrderRepository = TakeawayOrderRepository;
