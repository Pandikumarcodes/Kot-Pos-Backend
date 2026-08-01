const BaseRepository = require("./BaseRepository");
const Inventory = require("../models/Inventory");

class InventoryRepository extends BaseRepository {
  constructor() {
    super(Inventory);
  }

  findActive(filter) {
    return this.findMany({ ...filter, isActive: true })
      .populate("menuItemId", "ItemName available")
      .sort({ currentStock: 1 })
      .lean({ virtuals: true });
  }

  createInventory(data) {
    return this.create(data);
  }

  updateScoped(id, branchFilter, update) {
    return this.model.findOneAndUpdate(
      { _id: id, ...branchFilter },
      update,
      { new: true, runValidators: true },
    );
  }

  findScopedById(id, branchFilter) {
    return this.findOne({ _id: id, ...branchFilter });
  }

  deactivateScoped(id, branchFilter) {
    return this.model.findOneAndUpdate(
      { _id: id, ...branchFilter },
      { isActive: false },
      { new: true },
    );
  }

  findActiveByMenuItem(branchId, menuItemId) {
    return this.findOne({ branchId, menuItemId, isActive: true });
  }

  listLean(filter) {
    return this.findMany(filter).lean();
  }
}

module.exports = new InventoryRepository();
module.exports.InventoryRepository = InventoryRepository;
