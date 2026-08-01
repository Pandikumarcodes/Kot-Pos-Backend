const InventoryRepository =
  require("./InventoryRepository").InventoryRepository;

class SupplierRepository extends InventoryRepository {
  listInventoryBySupplier(branchId, supplier) {
    return this.findMany({ branchId, supplier, isActive: true });
  }
}

module.exports = new SupplierRepository();
module.exports.SupplierRepository = SupplierRepository;
