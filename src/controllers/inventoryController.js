const inventoryService = require("../services/inventoryService");
const { forwardError } = require("./controllerUtils");

const getInventory = async (req, res, next) => {
  try {
    res.json(await inventoryService.listInventory({
      branchFilter: req.branchFilter,
      lowStock: req.query.lowStock,
      category: req.query.category,
      search: req.query.search,
    }));
  } catch (err) { forwardError(next, err, "Failed to fetch inventory"); }
};

const createInventory = async (req, res, next) => {
  try {
    const item = await inventoryService.createInventory(req.body, { branchId: req.branchId, userId: req.user._id });
    res.status(201).json({ message: "Inventory item created", item });
  } catch (err) { forwardError(next, err, "Failed to create inventory item"); }
};

const updateInventory = async (req, res, next) => {
  try {
    const item = await inventoryService.updateInventory(req.params.id, req.branchFilter, req.body);
    res.json({ message: "Updated", item });
  } catch (err) { forwardError(next, err, "Failed to update inventory item"); }
};

const restockItem = async (req, res, next) => {
  try {
    const item = await inventoryService.restockItem(req.params.id, req.branchFilter, req.body, { branchId: req.branchId, userId: req.user._id });
    res.json({ message: `Restocked ${req.body.quantity} ${item.unit}`, item });
  } catch (err) { forwardError(next, err, "Failed to restock inventory item"); }
};

const adjustStock = async (req, res, next) => {
  try {
    const item = await inventoryService.adjustStock(req.params.id, req.branchFilter, req.body, { branchId: req.branchId, userId: req.user._id });
    res.json({ message: "Stock adjusted", item });
  } catch (err) { forwardError(next, err, "Failed to adjust inventory stock"); }
};

const getStockLogs = async (req, res, next) => {
  try { res.json({ logs: await inventoryService.getStockLogs(req.params.id, req.branchId) }); }
  catch (err) { forwardError(next, err, "Failed to fetch stock logs"); }
};

const deleteInventory = async (req, res, next) => {
  try {
    await inventoryService.deleteInventory(req.params.id, req.branchFilter);
    res.json({ message: "Item removed from inventory" });
  } catch (err) { forwardError(next, err, "Failed to remove inventory item"); }
};

module.exports = { getInventory, createInventory, updateInventory, restockItem, adjustStock, getStockLogs, deleteInventory };
