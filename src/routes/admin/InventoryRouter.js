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

router.use(userAuth, requireRoles(["admin", "manager"]), branchScope);

router.get("/", getInventory);
router.post("/", requireBranch, createInventory);
router.put("/:id", updateInventory);
router.post("/:id/restock", requireBranch, restockItem);
router.post("/:id/adjust", requireBranch, adjustStock);
router.get("/:id/logs", requireBranch, getStockLogs);
router.delete("/:id", deleteInventory);

module.exports = router;
