const inventoryRepository = require("../repositories/InventoryRepository");
const stockLogRepository = require("../repositories/StockLogRepository");
const menuRepository = require("../repositories/MenuRepository");
const AppError = require("../utils/AppError");

const listInventory = async ({ branchFilter, lowStock, category, search }) => {
  const filter = { ...branchFilter, isActive: true };
  if (lowStock === "true")
    filter.$expr = { $lte: ["$currentStock", "$lowStockThreshold"] };
  if (category) filter.category = category;
  if (search) filter.name = { $regex: search, $options: "i" };
  const items = await inventoryRepository.findActive(filter);
  const annotated = items.map((item) => ({
    ...item,
    isLowStock: item.currentStock <= item.lowStockThreshold,
  }));
  return {
    items: annotated,
    lowStockCount: annotated.filter((item) => item.isLowStock).length,
  };
};

const createInventory = async (input, { branchId, userId }) => {
  const {
    name,
    unit,
    currentStock,
    lowStockThreshold,
    category,
    costPerUnit,
    supplier,
    menuItemId,
  } = input;
  const item = await inventoryRepository.createInventory({
    branchId,
    name,
    unit: unit ?? "pcs",
    currentStock: currentStock ?? 0,
    lowStockThreshold: lowStockThreshold ?? 10,
    category: category ?? "other",
    costPerUnit: costPerUnit ?? 0,
    supplier: supplier ?? "",
    menuItemId: menuItemId || null,
  });
  if (currentStock > 0) {
    await stockLogRepository.createLog({
      branchId,
      inventoryId: item._id,
      type: "restock",
      quantity: currentStock,
      stockBefore: 0,
      stockAfter: currentStock,
      note: "Initial stock",
      doneBy: userId,
    });
  }
  return item;
};

const updateInventory = async (id, branchFilter, input) => {
  const {
    name,
    unit,
    lowStockThreshold,
    category,
    costPerUnit,
    supplier,
    menuItemId,
  } = input;
  const item = await inventoryRepository.updateScoped(id, branchFilter, {
    name,
    unit,
    lowStockThreshold,
    category,
    costPerUnit,
    supplier,
    menuItemId,
  });
  if (!item) throw new AppError("Item not found", 404);
  return item;
};

const restockItem = async (
  id,
  branchFilter,
  { quantity, note },
  { branchId, userId },
) => {
  const item = await inventoryRepository.findScopedById(id, branchFilter);
  if (!item) throw new AppError("Item not found", 404);
  const stockBefore = item.currentStock;
  item.currentStock += Number(quantity);
  await inventoryRepository.save(item);
  await stockLogRepository.createLog({
    branchId,
    inventoryId: item._id,
    type: "restock",
    quantity: Number(quantity),
    stockBefore,
    stockAfter: item.currentStock,
    note: note || "",
    doneBy: userId,
  });
  if (item.menuItemId && stockBefore === 0 && item.currentStock > 0) {
    await menuRepository.updateAvailability(item.menuItemId, true);
  }
  return item;
};

const adjustStock = async (
  id,
  branchFilter,
  { quantity, note },
  { branchId, userId },
) => {
  const item = await inventoryRepository.findScopedById(id, branchFilter);
  if (!item) throw new AppError("Item not found", 404);
  const stockBefore = item.currentStock;
  const newStock = Math.max(0, item.currentStock + Number(quantity));
  item.currentStock = newStock;
  await inventoryRepository.save(item);
  await stockLogRepository.createLog({
    branchId,
    inventoryId: item._id,
    type: "adjustment",
    quantity: Number(quantity),
    stockBefore,
    stockAfter: newStock,
    note: note || "Manual adjustment",
    doneBy: userId,
  });
  if (item.menuItemId && newStock === 0) {
    await menuRepository.updateAvailability(item.menuItemId, false);
  }
  return item;
};

const getStockLogs = (inventoryId, branchId) =>
  stockLogRepository.listForInventory(inventoryId, branchId);

const deleteInventory = async (id, branchFilter) => {
  const item = await inventoryRepository.deactivateScoped(id, branchFilter);
  if (!item) throw new AppError("Item not found", 404);
};

const deductStockForKot = async (kotItems, branchId, kotId, doneBy) => {
  for (const kotItem of kotItems) {
    const inventory = await inventoryRepository.findActiveByMenuItem(
      branchId,
      kotItem.itemId,
    );
    if (!inventory) continue;
    const stockBefore = inventory.currentStock;
    const deductAmount = kotItem.quantity * (inventory.deductRatio ?? 1);
    const newStock = Math.max(0, inventory.currentStock - deductAmount);
    inventory.currentStock = newStock;
    await inventoryRepository.save(inventory);
    await stockLogRepository.createLog({
      branchId,
      inventoryId: inventory._id,
      type: "kot_deduct",
      quantity: -deductAmount,
      stockBefore,
      stockAfter: newStock,
      note: "KOT deduction",
      kotId,
      doneBy,
    });
    if (inventory.menuItemId && newStock === 0) {
      await menuRepository.updateAvailability(inventory.menuItemId, false);
    }
  }
};

module.exports = {
  listInventory,
  createInventory,
  updateInventory,
  restockItem,
  adjustStock,
  getStockLogs,
  deleteInventory,
  deductStockForKot,
};
