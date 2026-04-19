const express = require("express");
const router = express.Router();
const Table = require("../../models/tables");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot");
const Settings = require("../../models/settings");
const Branch = require("../../models/Branch");

// ── GET /public/menu/:tableId ─────────────────────────────────
// Returns table info + available menu items grouped by category.
// Called when customer scans the QR code.
router.get("/menu/:tableId", async (req, res) => {
  try {
    const table = await Table.findById(req.params.tableId).lean();
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    // Fetch available menu items for this branch
    const menuItems = await MenuItem.find({ available: true }).lean();

    // Group by category
    const grouped = menuItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push({
        _id: item._id,
        ItemName: item.ItemName,
        price: item.price,
        category: item.category,
      });
      return acc;
    }, {});

    // Fetch restaurant name from settings
    const settings =
      (await Settings.findOne({
        branchId: table.branchId ?? null,
      }).lean()) ?? (await Settings.findOne({ branchId: null }).lean());

    res.json({
      table: {
        _id: table._id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        // ── FIX: include branchId so frontend can pass it when ordering ──
        branchId: table.branchId ?? null,
      },
      restaurant: {
        name: settings?.businessName ?? "KOT POS Restaurant",
        address: settings?.address ?? "",
        phone: settings?.phone ?? "",
      },
      menu: grouped,
      categories: Object.keys(grouped),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /public/order/:tableId ───────────────────────────────
// Customer places order directly from their phone.
// Body: { customerName, customerPhone, items: [{ itemId, quantity }] }
router.post("/order/:tableId", async (req, res) => {
  try {
    const { customerName, customerPhone, items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "No items in order" });
    }

    const table = await Table.findById(req.params.tableId).lean();
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    // ── FIX: resolve branchId from table or fall back to first branch ──
    let branchId = table.branchId ?? null;

    if (!branchId) {
      // Table was seeded without branchId — find the first active branch
      const branch = await Branch.findOne({ isActive: true }).lean();
      if (branch) {
        branchId = branch._id;
        // Also update the table so future orders don't need this fallback
        await Table.findByIdAndUpdate(table._id, { branchId: branch._id });
      }
    }

    if (!branchId) {
      return res.status(400).json({
        error:
          "Branch configuration missing. Please ask a staff member for help.",
      });
    }

    // Validate and build order items
    const menuItems = await MenuItem.find({
      _id: { $in: items.map((i) => i.itemId) },
      available: true,
    }).lean();

    if (menuItems.length !== items.length) {
      return res.status(400).json({ error: "Some items are unavailable" });
    }

    const orderItems = items.map((i) => {
      const found = menuItems.find((m) => m._id.toString() === i.itemId);
      return {
        itemId: found._id,
        name: found.ItemName,
        quantity: i.quantity,
        price: found.price,
      };
    });

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Create KOT — createdBy is null for customer self-orders
    const kot = await Kot.create({
      branchId, // ← now always populated
      orderType: "dine-in",
      tableNumber: table.tableNumber,
      tableId: table._id,
      customerName: customerName || "Guest",
      customerPhone: customerPhone || "",
      createdBy: null, // self-order — no staff login
      items: orderItems,
      totalAmount,
      status: "pending",
    });

    // Update table status to occupied if it was available
    if (table.status === "available") {
      await Table.findByIdAndUpdate(table._id, { status: "occupied" });
    }

    res.status(201).json({
      message: "Order placed! Kitchen has been notified.",
      orderId: kot._id,
      totalAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /public/order/:orderId/status ─────────────────────────
// Customer can poll to check their order status.
router.get("/order/:orderId/status", async (req, res) => {
  try {
    const kot = await Kot.findById(req.params.orderId)
      .select("status totalAmount items createdAt")
      .lean();

    if (!kot) return res.status(404).json({ error: "Order not found" });

    const statusMessages = {
      pending: "Your order has been received! Kitchen is preparing...",
      preparing: "Kitchen is preparing your order 🍳",
      ready: "Your order is ready! Waiter will serve you shortly 🎉",
      served: "Enjoy your meal! 😊",
      cancelled: "Your order was cancelled. Please ask a waiter for help.",
    };

    res.json({
      status: kot.status,
      message: statusMessages[kot.status] ?? "Processing...",
      items: kot.items,
      total: kot.totalAmount,
      orderedAt: kot.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
