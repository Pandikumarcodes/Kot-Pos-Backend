const BaseRepository = require("./BaseRepository");
const Kot = require("../models/kot");

class KitchenRepository extends BaseRepository {
  constructor() {
    super(Kot);
  }

  listActive(filter) {
    return this.findMany(filter).sort({ createdAt: 1 });
  }

  findScoped(filter) {
    return this.findOne(filter);
  }

  updateStatus(filter, status) {
    return this.model.findOneAndUpdate(filter, { status }, { new: true });
  }

  createOrder(data) {
    return this.create(data);
  }

  findPublicStatus(id) {
    return this.findById(id)
      .select("status totalAmount items createdAt")
      .lean();
  }

  countByFilter(filter) {
    return this.count(filter);
  }

  listLean(filter) {
    return this.findMany(filter).lean();
  }
}

module.exports = new KitchenRepository();
module.exports.KitchenRepository = KitchenRepository;
