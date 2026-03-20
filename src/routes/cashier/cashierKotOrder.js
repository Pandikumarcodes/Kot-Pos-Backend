const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const cashierKotRouter = express.Router();
const TakeAway = require("../../models/takeAway");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot");
const { deductStockForKot } = require("../../controllers/inventoryController");

// ── Notification service ──────────────────────────────────────
const { notify } = require("../../services/notificationservices");

// branchScope runs AFTER userAuth so req.user is already populated
cashierKotRouter.use(
  userAuth,
  allowRoles(["cashier", "admin", "manager"]),
  branchScope,
);

// ── CREATE TAKEAWAY ORDER ─────────────────────────────────────
cashierKotRouter.post("/takeaway-orders", async (req, res) => {
  try {
    const { customerName, customerPhone, items } = req.body;
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
    const newOrder = new TakeAway({
      customerName,
      customerPhone,
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

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET ALL TAKEAWAY ORDERS ───────────────────────────────────
cashierKotRouter.get("/takeaway-orders", async (req, res) => {
  try {
    const myOrders = await TakeAway.find().sort({ createdAt: -1 });
    res.status(200).json({ myOrders: myOrders || [] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET SINGLE TAKEAWAY ORDER ─────────────────────────────────
cashierKotRouter.get("/takeaway/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TakeAway.findById(orderId)
      .populate("createdBy", "username")
      .populate("items.itemId", "ItemName price");
    if (!order)
      return res.status(404).json({ error: "This order Id not found" });
    res.status(200).json({ message: "Single order", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── SEND TO KITCHEN ───────────────────────────────────────────
cashierKotRouter.put("/takeaway/:orderId/send", async (req, res) => {
  const { orderId } = req.params;
  try {
    // Prevent duplicate KOTs — check status before proceeding
    const existingOrder = await TakeAway.findById(orderId);
    if (!existingOrder)
      return res.status(404).json({ error: "Order not found" });
    if (existingOrder.status === "sent_to_kitchen") {
      return res
        .status(409)
        .json({ error: "Order has already been sent to kitchen" });
    }

    const order = await TakeAway.findByIdAndUpdate(
      orderId,
      { status: "sent_to_kitchen" },
      { new: true },
    );

    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const kot = await Kot.create({
      branchId: req.branchId,
      orderType: "takeaway",
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      createdBy: order.createdBy,
      items: order.items,
      totalAmount,
      status: "pending",
    });

    // ── Notify kitchen + admin ────────────────────────────────
    const io = req.app.get("io");
    notify.newOrder(io, kot);

    res.status(200).json({ message: "Order sent to kitchen (KOT)", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── MARK RECEIVED ─────────────────────────────────────────────
cashierKotRouter.put("/takeaway/:orderId/received", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TakeAway.findByIdAndUpdate(
      orderId,
      { status: "received" },
      { new: true },
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Order received successfully", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── CANCEL ORDER ──────────────────────────────────────────────
cashierKotRouter.put("/takeaway/:orderId/cancel", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TakeAway.findByIdAndUpdate(
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

module.exports = { cashierKotRouter };
