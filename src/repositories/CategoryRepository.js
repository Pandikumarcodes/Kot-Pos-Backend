const menuRepository = require("./MenuRepository");

const listItemsByCategory = (category, options = {}) =>
  menuRepository.findMany({ category }, undefined, options);

module.exports = {
  ...menuRepository,
  listItemsByCategory,
};
