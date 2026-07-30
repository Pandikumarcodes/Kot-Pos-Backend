const express = require("express");
const router = express.Router();
const { userAuth, requireRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { requireBranch } = branchScope;
const {
  getInventory,
  createInventory,
  updateInventory,
  restockItem,
  adjustStock,
  getStockLogs,
  deleteInventory,
} = require("../../controllers/inventoryController");
const {
  validateInventoryAdjust,
  validateInventoryCreate,
  validateInventoryId,
  validateInventoryQuery,
  validateInventoryRestock,
  validateInventoryUpdate,
} = require("../../validators/inventory");

router.use(userAuth, requireRoles(["admin", "manager"]), branchScope);

router.get("/", validateInventoryQuery, getInventory);
router.post("/", requireBranch, validateInventoryCreate, createInventory);
router.put("/:id", validateInventoryUpdate, updateInventory);
router.post(
  "/:id/restock",
  requireBranch,
  validateInventoryRestock,
  restockItem,
);
router.post(
  "/:id/adjust",
  requireBranch,
  validateInventoryAdjust,
  adjustStock,
);
router.get("/:id/logs", requireBranch, validateInventoryId, getStockLogs);
router.delete("/:id", validateInventoryId, deleteInventory);

module.exports = router;
