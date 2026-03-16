const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const {
  getInventory,
  createInventory,
  updateInventory,
  restockItem,
  adjustStock,
  getStockLogs,
  deleteInventory,
} = require("../../controllers/inventoryController");

router.use(userAuth, branchScope);

router.get("/", getInventory);
router.post("/", createInventory);
router.put("/:id", updateInventory);
router.post("/:id/restock", restockItem);
router.post("/:id/adjust", adjustStock);
router.get("/:id/logs", getStockLogs);
router.delete("/:id", deleteInventory);

module.exports = router;
