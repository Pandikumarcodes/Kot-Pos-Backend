const MenuRepository = require("./MenuRepository").MenuRepository;

class CategoryRepository extends MenuRepository {
  listItemsByCategory(category) {
    return this.findMany({ category });
  }
}

module.exports = new CategoryRepository();
module.exports.CategoryRepository = CategoryRepository;
