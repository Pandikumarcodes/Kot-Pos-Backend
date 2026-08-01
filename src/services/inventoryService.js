const inventoryRepository = require("../repositories/InventoryRepository");
const stockLogRepository = require("../repositories/StockLogRepository");
const menuRepository = require("../repositories/MenuRepository");
const userRepository = require("../repositories/UserRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");
const inventoryAudit = require("../modules/inventory/InventoryAuditLogger");
const AppError = require("../utils/AppError");

const transactionManager = new TransactionManager();

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

const actorContext = async ({ branchId, userId, actorRole, correlationId }) => {
  const actor = actorRole
    ? null
    : await userRepository.findByIdWithSelection(userId, "role");
  return inventoryAudit.createContext({
    actorId: userId,
    actorRole: actorRole || actor?.role || null,
    branchId,
    correlationId,
  });
};

const writeFailure = async (values) => {
  try {
    await inventoryAudit.failure(values);
  } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const createInventory = async (
  input,
  { branchId, userId, actorRole = null, correlationId = null },
) => {
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
  const initialStock = currentStock ?? 0;
  let auditContext = inventoryAudit.createContext({
    actorId: userId,
    actorRole,
    branchId,
    correlationId,
  });
  let inventoryId = "inventory:pending";

  try {
    auditContext = await actorContext({
      branchId,
      userId,
      actorRole,
      correlationId: auditContext.correlationId,
    });
    return await transactionManager.execute(async (session) => {
      const item = await inventoryRepository.createInventory(
        {
          branchId,
          name,
          unit: unit ?? "pcs",
          currentStock: initialStock,
          lowStockThreshold: lowStockThreshold ?? 10,
          category: category ?? "other",
          costPerUnit: costPerUnit ?? 0,
          supplier: supplier ?? "",
          menuItemId: menuItemId || null,
        },
        { session },
      );
      inventoryId = item._id;
      let stockLog = null;
      if (initialStock > 0) {
        stockLog = await stockLogRepository.createLog(
          {
            branchId,
            inventoryId: item._id,
            type: "restock",
            quantity: initialStock,
            stockBefore: 0,
            stockAfter: initialStock,
            note: "Initial stock",
            doneBy: userId,
          },
          { session },
        );
      }
      if (item.menuItemId) {
        await menuRepository.updateAvailability(
          item.menuItemId,
          initialStock > 0,
          { session },
        );
      }
      await inventoryAudit.created(
        {
          context: auditContext,
          item,
          initialQuantity: initialStock,
          stockLogId: stockLog?._id,
        },
        { session },
      );
      return item;
    });
  } catch (error) {
    await writeFailure({
      action: AUDIT_ACTIONS.INVENTORY_CREATE,
      context: auditContext,
      entityId: inventoryId,
      error,
    });
    throw error;
  }
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
  { branchId, userId, actorRole = null, correlationId = null },
) => {
  let auditContext = inventoryAudit.createContext({
    actorId: userId,
    actorRole,
    branchId,
    correlationId,
  });
  try {
    auditContext = await actorContext({
      branchId,
      userId,
      actorRole,
      correlationId: auditContext.correlationId,
    });
    return await transactionManager.execute(async (session) => {
      const item = await inventoryRepository.findScopedById(id, branchFilter, {
        session,
      });
      if (!item) throw new AppError("Item not found", 404);
      const stockBefore = item.currentStock;
      item.currentStock += Number(quantity);
      await inventoryRepository.save(item, { session });
      const stockLog = await stockLogRepository.createLog(
        {
          branchId,
          inventoryId: item._id,
          type: "restock",
          quantity: Number(quantity),
          stockBefore,
          stockAfter: item.currentStock,
          note: note || "",
          doneBy: userId,
        },
        { session },
      );
      const availabilityChanged = Boolean(
        item.menuItemId && stockBefore === 0 && item.currentStock > 0,
      );
      if (availabilityChanged) {
        await menuRepository.updateAvailability(item.menuItemId, true, {
          session,
        });
      }
      await inventoryAudit.restocked(
        {
          context: auditContext,
          item,
          previousQuantity: stockBefore,
          addedQuantity: Number(quantity),
          stockLogId: stockLog?._id,
          availabilityChanged,
        },
        { session },
      );
      return item;
    });
  } catch (error) {
    await writeFailure({
      action: AUDIT_ACTIONS.INVENTORY_RESTOCK,
      context: auditContext,
      entityId: id,
      error,
    });
    throw error;
  }
};

const adjustStock = async (
  id,
  branchFilter,
  { quantity, note },
  { branchId, userId, actorRole = null, correlationId = null },
) => {
  let auditContext = inventoryAudit.createContext({
    actorId: userId,
    actorRole,
    branchId,
    correlationId,
  });
  try {
    auditContext = await actorContext({
      branchId,
      userId,
      actorRole,
      correlationId: auditContext.correlationId,
    });
    return await transactionManager.execute(async (session) => {
      const item = await inventoryRepository.findScopedById(id, branchFilter, {
        session,
      });
      if (!item) throw new AppError("Item not found", 404);
      const stockBefore = item.currentStock;
      const newStock = Math.max(0, item.currentStock + Number(quantity));
      item.currentStock = newStock;
      await inventoryRepository.save(item, { session });
      const stockLog = await stockLogRepository.createLog(
        {
          branchId,
          inventoryId: item._id,
          type: "adjustment",
          quantity: Number(quantity),
          stockBefore,
          stockAfter: newStock,
          note: note || "Manual adjustment",
          doneBy: userId,
        },
        { session },
      );
      const availabilityChanged = Boolean(
        item.menuItemId && (stockBefore === 0) !== (newStock === 0),
      );
      if (availabilityChanged) {
        await menuRepository.updateAvailability(item.menuItemId, newStock > 0, {
          session,
        });
      }
      await inventoryAudit.adjusted(
        {
          context: auditContext,
          item,
          previousQuantity: stockBefore,
          reason: note || "Manual adjustment",
          stockLogId: stockLog?._id,
          availabilityChanged,
        },
        { session },
      );
      return item;
    });
  } catch (error) {
    await writeFailure({
      action: AUDIT_ACTIONS.INVENTORY_ADJUST,
      context: auditContext,
      entityId: id,
      error,
    });
    throw error;
  }
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
