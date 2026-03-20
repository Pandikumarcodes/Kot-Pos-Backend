const Inventory = require("../models/Inventory");
const StockLog = require("../models/StockLog");
const MenuItem = require("../models/menuItems");

// ── GET /admin/inventory ──────────────────────────────────────
// List all inventory items for this branch.
// ?lowStock=true  →  only items at or below threshold
// ?category=dairy →  filter by category
// ?search=paneer  →  name search
async function getInventory(req, res) {
  try {
    const filter = { ...req.branchFilter, isActive: true };

    if (req.query.lowStock === "true") {
      // MongoDB can't compare two fields directly without $expr
      filter.$expr = { $lte: ["$currentStock", "$lowStockThreshold"] };
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: "i" };
    }

    const items = await Inventory.find(filter)
      .populate("menuItemId", "ItemName available")
      .sort({ currentStock: 1 }) // lowest stock first
      .lean({ virtuals: true });

    // Annotate isLowStock manually since .lean() loses virtuals
    const annotated = items.map((item) => ({
      ...item,
      isLowStock: item.currentStock <= item.lowStockThreshold,
    }));

    const lowStockCount = annotated.filter((i) => i.isLowStock).length;

    res.json({ items: annotated, lowStockCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST /admin/inventory ─────────────────────────────────────
// Create a new inventory item.
async function createInventory(req, res) {
  try {
    const {
      name,
      unit,
      currentStock,
      lowStockThreshold,
      category,
      costPerUnit,
      supplier,
      menuItemId,
    } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const item = await Inventory.create({
      branchId: req.branchId,
      name,
      unit: unit ?? "pcs",
      currentStock: currentStock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 10,
      category: category ?? "other",
      costPerUnit: costPerUnit ?? 0,
      supplier: supplier ?? "",
      menuItemId: menuItemId || null,
    });

    // Log initial stock if > 0
    if (currentStock > 0) {
      await StockLog.create({
        branchId: req.branchId,
        inventoryId: item._id,
        type: "restock",
        quantity: currentStock,
        stockBefore: 0,
        stockAfter: currentStock,
        note: "Initial stock",
        doneBy: req.user._id,
      });
    }

    res.status(201).json({ message: "Inventory item created", item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── PUT /admin/inventory/:id ──────────────────────────────────
// Update item details (not stock — use restock for that).
async function updateInventory(req, res) {
  try {
    const {
      name,
      unit,
      lowStockThreshold,
      category,
      costPerUnit,
      supplier,
      menuItemId,
    } = req.body;

    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, ...req.branchFilter },
      {
        name,
        unit,
        lowStockThreshold,
        category,
        costPerUnit,
        supplier,
        menuItemId,
      },
      { new: true, runValidators: true },
    );

    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Updated", item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST /admin/inventory/:id/restock ────────────────────────
// Add stock to an item. Body: { quantity, note }
async function restockItem(req, res) {
  try {
    const { quantity, note } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    const item = await Inventory.findOne({
      _id: req.params.id,
      ...req.branchFilter,
    });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const stockBefore = item.currentStock;
    item.currentStock += Number(quantity);
    await item.save();

    await StockLog.create({
      branchId: req.branchId,
      inventoryId: item._id,
      type: "restock",
      quantity: Number(quantity),
      stockBefore,
      stockAfter: item.currentStock,
      note: note || "",
      doneBy: req.user._id,
    });

    // If item was linked to a MenuItem and was out of stock → re-enable it
    if (item.menuItemId && stockBefore === 0 && item.currentStock > 0) {
      await MenuItem.findByIdAndUpdate(item.menuItemId, { available: true });
    }

    res.json({ message: `Restocked ${quantity} ${item.unit}`, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── POST /admin/inventory/:id/adjust ─────────────────────────
// Manual correction (waste, spillage, audit count).
// Body: { quantity (can be negative), note }
async function adjustStock(req, res) {
  try {
    const { quantity, note } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    const item = await Inventory.findOne({
      _id: req.params.id,
      ...req.branchFilter,
    });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const stockBefore = item.currentStock;
    const newStock = Math.max(0, item.currentStock + Number(quantity));

    item.currentStock = newStock;
    await item.save();

    await StockLog.create({
      branchId: req.branchId,
      inventoryId: item._id,
      type: "adjustment",
      quantity: Number(quantity),
      stockBefore,
      stockAfter: newStock,
      note: note || "Manual adjustment",
      doneBy: req.user._id,
    });

    // Auto-disable linked MenuItem if stock hits 0
    if (item.menuItemId && newStock === 0) {
      await MenuItem.findByIdAndUpdate(item.menuItemId, { available: false });
    }

    res.json({ message: "Stock adjusted", item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET /admin/inventory/:id/logs ────────────────────────────
// Audit trail for a single inventory item.
async function getStockLogs(req, res) {
  try {
    // FIX (minor): Added branchId filter to prevent cross-branch log access
    const logs = await StockLog.find({
      inventoryId: req.params.id,
      branchId: req.branchId,
    })
      .populate("doneBy", "username role")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── DELETE /admin/inventory/:id ───────────────────────────────
// Soft delete only.
async function deleteInventory(req, res) {
  try {
    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, ...req.branchFilter },
      { isActive: false },
      { new: true },
    );
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item removed from inventory" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Utility: deductStockForKot ────────────────────────────────
// Called internally when a KOT is created.
// Pass items array from the KOT and the branchId.
// Only deducts from items that have a matching menuItemId link.
async function deductStockForKot(kotItems, branchId, kotId, doneBy) {
  for (const kotItem of kotItems) {
    const inv = await Inventory.findOne({
      branchId,
      menuItemId: kotItem.itemId,
      isActive: true,
    });

    if (!inv) continue; // No inventory link — skip silently

    const stockBefore = inv.currentStock;
    // FIX 6: Use deductRatio to support recipe-based multipliers (defaults to 1)
    const deductAmount = kotItem.quantity * (inv.deductRatio ?? 1);
    const newStock = Math.max(0, inv.currentStock - deductAmount);

    inv.currentStock = newStock;
    await inv.save();

    await StockLog.create({
      branchId,
      inventoryId: inv._id,
      type: "kot_deduct",
      quantity: -deductAmount,
      stockBefore,
      stockAfter: newStock,
      note: `KOT deduction`,
      kotId,
      doneBy,
    });

    // Auto-disable MenuItem if stock hits 0
    if (inv.menuItemId && newStock === 0) {
      await MenuItem.findByIdAndUpdate(inv.menuItemId, { available: false });
    }
  }
}

module.exports = {
  getInventory,
  createInventory,
  updateInventory,
  restockItem,
  adjustStock,
  getStockLogs,
  deleteInventory,
  deductStockForKot,
};
