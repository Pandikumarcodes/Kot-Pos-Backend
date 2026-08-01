const menuRepository = require("./MenuRepository");

const listItemsByCategory = (category) => menuRepository.findMany({ category });

module.exports = {
  ...menuRepository,
  listItemsByCategory,
};
