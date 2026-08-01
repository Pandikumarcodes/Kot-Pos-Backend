const inventoryRepository = require("./InventoryRepository");

const listInventoryBySupplier = (branchId, supplier) =>
  inventoryRepository.findMany({ branchId, supplier, isActive: true });

module.exports = {
  ...inventoryRepository,
  listInventoryBySupplier,
};
