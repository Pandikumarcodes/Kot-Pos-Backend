const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const waiterOrderRouter = express.Router();
const TableOrder = require("../../models/waiter");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot");
const Table = require("../../models/tables");
const Billing = require("../../models/billings");
const { deductStockForKot } = require("../../controllers/inventoryController");
const { notify } = require("../../services/notificationservices");

waiterOrderRouter.use(
  userAuth,
  allowRoles(["waiter", "manager", "admin", "cashier"]),
  branchScope,
);

// ── GET MENU ─────────────────────────────────────────────────
waiterOrderRouter.get("/menu", async (req, res) => {
  try {
    const filter = { available: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search)
      filter.ItemName = { $regex: req.query.search, $options: "i" };

    const menuItems = await MenuItem.find(filter)
      .select("ItemName price category description image available")
      .sort({ category: 1, ItemName: 1 });

    res.status(200).json({ menuItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ALL ORDERS FOR A TABLE ────────────────────────────────

waiterOrderRouter.get("/orders/table/:tableId", async (req, res) => {
  const { tableId } = req.params;
  try {
    const orders = await TableOrder.find({
      tableId,
      status: { $nin: ["cancelled", "served"] },
    })
      .populate("createdBy", "username")
      .sort({ createdAt: 1 });

    const allItems = orders.flatMap((o) =>
      o.items.map((item) => ({
        ...item.toObject(),
        orderId: o._id,
        round: orders.indexOf(o) + 1,
        status: o.status,
      })),
    );

    const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Always return 200 — empty array is valid (table has no active orders)
    res.status(200).json({ orders, allItems, grandTotal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── SEND TO CASHIER ───────────────────────────────────────────

waiterOrderRouter.post(
  "/orders/table/:tableId/send-to-cashier",
  async (req, res) => {
    const { tableId } = req.params;
    try {
      const { customerName, customerPhone, tableNumber } = req.body;

      // FIX 1: existingBill check inside try so errors are caught
      const existingBill = await Billing.findOne({
        tableId,
        paymentStatus: "unpaid",
      });
      if (existingBill) {
        return res.status(400).json({
          error:
            "An unpaid bill already exists for this table. Please ask the cashier to collect payment first.",
        });
      }

      // Strip non-digits, use placeholder if not 10 digits
      const phone = (customerPhone || "").replace(/\D/g, "");
      const validPhone = phone.length === 10 ? phone : "0000000000";

      // Fetch all non-cancelled, non-served orders for this table
      const orders = await TableOrder.find({
        tableId,
        status: { $nin: ["cancelled", "served"] },
      });

      if (!orders.length) {
        return res
          .status(400)
          .json({ error: "No active orders found for this table" });
      }

      // Combine all items across all rounds
      const allItems = orders.flatMap((o) => o.items);
      const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

      const billItems = allItems.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      }));

      // Generate bill number same format as cashier
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await Billing.countDocuments({
        createdAt: { $gte: todayStart },
      });
      const billNumber = `BILL-${today}-${(todayCount + 1)
        .toString()
        .padStart(3, "0")}`;

      // FIX 2: use validPhone not phone
      const bill = await Billing.create({
        billNumber,
        customerName: customerName || "Walk-in",
        customerPhone: validPhone,
        items: billItems,
        totalAmount: grandTotal,
        paymentStatus: "unpaid",
        paymentMethod: "none",
        tableId,
        tableNumber: tableNumber || null,
        createdBy: req.user._id,
      });

      // Mark all active table orders as served
      await TableOrder.updateMany(
        { tableId, status: { $nin: ["cancelled", "served"] } },
        { status: "served" },
      );

      // Update table status to billing
      await Table.findByIdAndUpdate(tableId, { status: "billing" });

      // Notify cashier
      const io = req.app.get("io");
      notify.billingUpdated(io, bill);

      res.status(201).json({ message: "Bill sent to cashier", bill });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// ── CREATE ORDER ─────────────────────────────────────────────
waiterOrderRouter.post("/orders", async (req, res) => {
  try {
    const { tableNumber, customerName, tableId, items } = req.body;

    if (!tableId || !items || !items.length) {
      return res.status(400).json({ error: "tableId and items are required" });
    }

    const menuItems = await MenuItem.find({
      _id: { $in: items.map((i) => i.itemId) },
    });

    if (menuItems.length !== items.length) {
      return res.status(400).json({ error: "Some menu items not found" });
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

    const newOrder = new TableOrder({
      tableNumber,
      customerName: customerName || "Walk-in",
      tableId,
      createdBy: req.user._id,
      items: orderItems,
      totalAmount,
    });

    await newOrder.save();

    if (req.branchId) {
      deductStockForKot(
        newOrder.items,
        req.branchId,
        newOrder._id,
        req.user._id,
      ).catch((err) => console.error("Stock deduction failed:", err.message));
    }

    res
      .status(201)
      .json({ message: "Order created successfully", order: newOrder });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET ALL ORDERS ───────────────────────────────────────────
waiterOrderRouter.get("/orders", async (req, res) => {
  try {
    const myOrders = await TableOrder.find(req.branchFilter ?? {})
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });
    res.status(200).json({ myOrders });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET SINGLE ORDER ─────────────────────────────────────────
waiterOrderRouter.get("/orders/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findById(orderId)
      .populate("createdBy", "username")
      .populate("items.itemId", "ItemName price");

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── SEND TO KITCHEN ──────────────────────────────────────────
waiterOrderRouter.put("/orders/:orderId/send", async (req, res) => {
  const { orderId } = req.params;
  try {
    const existingOrder = await TableOrder.findById(orderId);
    if (!existingOrder)
      return res.status(404).json({ error: "Order not found" });
    if (existingOrder.status === "sent_to_kitchen") {
      return res
        .status(409)
        .json({ error: "Order has already been sent to kitchen" });
    }

    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "sent_to_kitchen" },
      { new: true },
    );

    const table = await Table.findById(order.tableId);

    const kot = await Kot.create({
      branchId: req.branchId,
      orderType: "dine-in",
      tableNumber: table?.tableNumber || order.tableNumber,
      tableId: order.tableId,
      customerName: order.customerName,
      createdBy: order.createdBy,
      items: order.items,
      totalAmount: order.totalAmount,
      status: "pending",
    });

    const io = req.app.get("io");
    notify.newOrder(io, kot);

    res.status(200).json({ message: "Order sent to kitchen (KOT)", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── MARK SERVED ──────────────────────────────────────────────
waiterOrderRouter.put("/orders/:orderId/served", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "served" },
      { new: true },
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Order marked as served", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── CANCEL ORDER ─────────────────────────────────────────────
waiterOrderRouter.put("/orders/:orderId/cancel", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "cancelled" },
      { new: true },
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Order has been cancelled", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { waiterOrderRouter };
