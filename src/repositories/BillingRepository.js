const BaseRepository = require("./BaseRepository");
const Billing = require("../models/billings");

class BillingRepository extends BaseRepository {
  constructor() {
    super(Billing);
  }

  countCreatedSince(date) {
    return this.count({ createdAt: { $gte: date } });
  }

  createBillDocument(data) {
    return this.createDocument(data);
  }

  createBill(data) {
    return this.create(data);
  }

  listScoped(filter) {
    return this.findMany(filter)
      .populate("createdBy", "username role")
      .sort({ createdAt: -1 });
  }

  findScopedWithCreator(filter) {
    return this.findOne(filter).populate("createdBy", "username role");
  }

  findScoped(filter) {
    return this.findOne(filter);
  }

  deleteScoped(filter) {
    return this.model.findOneAndDelete(filter);
  }

  listLean(filter) {
    return this.findMany(filter).lean();
  }
}

module.exports = new BillingRepository();
module.exports.BillingRepository = BillingRepository;
