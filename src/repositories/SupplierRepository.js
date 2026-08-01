const inventoryRepository = require("./InventoryRepository");

const listInventoryBySupplier = (branchId, supplier, options = {}) =>
  inventoryRepository.findMany(
    { branchId, supplier, isActive: true },
    undefined,
    options,
  );

module.exports = {
  ...inventoryRepository,
  listInventoryBySupplier,
};
