const BaseRepository = require("./BaseRepository");
const TableOrder = require("../models/waiter");

class OrderRepository extends BaseRepository {
  constructor() {
    super(TableOrder);
  }

  listTableActive(filter) {
    return this.findMany(filter)
      .populate("createdBy", "username")
      .sort({ createdAt: 1 });
  }

  listScoped(filter) {
    return this.findMany(filter)
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });
  }

  findScopedWithDetails(filter) {
    return this.findOne(filter)
      .populate("createdBy", "username")
      .populate("items.itemId", "ItemName price");
  }

  createOrderDocument(data) {
    return this.createDocument(data);
  }

  createOrder(data) {
    return this.create(data);
  }

  updateStatus(filter, status) {
    return this.model.findOneAndUpdate(filter, { status }, { new: true });
  }

  updateManyStatus(filter, status) {
    return this.model.updateMany(filter, { status });
  }

  countScoped(filter) {
    return this.count(filter);
  }
}

module.exports = new OrderRepository();
module.exports.OrderRepository = OrderRepository;
