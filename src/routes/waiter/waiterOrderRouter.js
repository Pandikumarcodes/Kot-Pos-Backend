const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const waiterOrderRouter = express.Router();
const TableOrder = require("../../models/waiter");
const MenuItem = require("../../models/menuItems");
waiterOrderRouter.use(userAuth, allowRoles(["waiter"]));

waiterOrderRouter.post("/orders", async (req, res) => {
  try {
    const { tableNumber, customerName, tableId, items } = req.body;
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
      0
    );
    const newOrder = new TableOrder({
      tableNumber,
      customerName,
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

waiterOrderRouter.get("/orders", async (req, res) => {
  try {
    const myOrders = await TableOrder.find();

    if (!myOrders.length) {
      return res.status(404).json({ error: "No orders found" });
    }
    res.status(200).json({ myOrders });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

waiterOrderRouter.get("/orders/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findById(orderId)
      .populate("createdBy", "username")
      .populate("items.itemId", "ItemName price");

    if (!order) {
      return res.status(404).json({ error: "This order Id not found" });
    }
    res.status(200).json({
      message: "This is singleorder Bill",
      order,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
waiterOrderRouter.put("/orders/:orderId/send", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "sent_to_kitchen" },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({
      message: "Order sent to kitchen (KOT)",
      order,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
waiterOrderRouter.put("/orders/:orderId/served", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "served" },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({
      message: "Order marked as served",
      order,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

waiterOrderRouter.put("/orders/:orderId/cancel", async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await TableOrder.findByIdAndUpdate(
      orderId,
      { status: "cancelled" },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({
      message: "Order has been cancelled",
      order,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// waiterOrderRouter.delete("/orders/:orderId", (req, res) => {
//   res.json({ message: "Send order to kitchen (KOT)" });
// });

module.exports = { waiterOrderRouter };
