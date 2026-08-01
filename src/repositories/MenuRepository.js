const BaseRepository = require("./BaseRepository");
const MenuItem = require("../models/menuItems");

class MenuRepository extends BaseRepository {
  constructor() {
    super(MenuItem);
  }

  findByName(ItemName) {
    return this.findOne({ ItemName });
  }

  createMenuDocument(data) {
    return this.createDocument(data);
  }

  listAll() {
    return this.findMany().lean();
  }

  updateMenuItem(id, update) {
    return this.updateById(id, update, { new: true, runValidators: true });
  }

  deleteMenuItem(id) {
    return this.deleteById(id);
  }

  listAvailable(filter = { available: true }) {
    return this.findMany(filter)
      .select("ItemName price category description image available")
      .sort({ category: 1, ItemName: 1 });
  }

  listAvailableLean() {
    return this.findMany({ available: true }).lean();
  }

  findByIds(ids, { availableOnly = false, lean = false } = {}) {
    const filter = { _id: { $in: ids } };
    if (availableOnly) filter.available = true;
    const query = this.findMany(filter);
    return lean && query && typeof query.lean === "function" ? query.lean() : query;
  }

  updateAvailability(id, available) {
    return this.updateById(id, { available });
  }
}

module.exports = new MenuRepository();
module.exports.MenuRepository = MenuRepository;
