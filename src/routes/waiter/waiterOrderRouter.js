const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const waiterOrderRouter = express.Router();
const TableOrder = require("../../models/waiter");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot"); // ✅ import Kot model
const Table = require("../../models/tables"); // ✅ import Table model

// ✅ All roles that take orders
waiterOrderRouter.use(
  userAuth,
  allowRoles(["waiter", "manager", "admin", "cashier"]),
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

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET ALL ORDERS ───────────────────────────────────────────
waiterOrderRouter.get("/orders", async (req, res) => {
  try {
    const myOrders = await TableOrder.find()
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });

    // ✅ Return empty array instead of 404
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

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── SEND TO KITCHEN ──────────────────────────────────────────
waiterOrderRouter.put("/orders/:orderId/send", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "sent_to_kitchen" },
      { new: true },
    );
    if (!order) return res.status(404).json({ error: "Order not found" });

    // ✅ Get table number from Table model
    const table = await Table.findById(order.tableId);

    // ✅ Create KOT entry so chef can see it
    await Kot.create({
      orderType: "dine-in",
      tableNumber: table?.tableNumber || order.tableNumber,
      tableId: order.tableId,
      customerName: order.customerName,
      createdBy: order.createdBy,
      items: order.items,
      totalAmount: order.totalAmount,
      status: "pending",
    });

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
