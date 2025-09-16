const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const chefRouter = express.Router();
const Kot = require("../../models/kot");
chefRouter.use(userAuth, allowRoles(["chef"]));

chefRouter.get("/kot", async (req, res) => {
  try {
    const KotOrders = await Kot.find({ status: "pending" });
    res.json({ KotOrders });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

chefRouter.get("/kot/:orderId", async (req, res) => {
  try {
    const order = await Kot.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

chefRouter.put("/kot/:orderId/start", async (req, res) => {
  try {
    const order = await Kot.findByIdAndUpdate(
      req.params.orderId,
      { status: "preparing" },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ message: "Order marked as preparing", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

chefRouter.put("/kot/:orderId/ready", async (req, res) => {
  try {
    const order = await Kot.findByIdAndUpdate(
      req.params.orderId,
      { status: "ready" },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ message: "Order marked as ready", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
chefRouter.put("/kot/:orderId/cancel", async (req, res) => {
  try {
    const order = await Kot.findByIdAndUpdate(
      req.params.orderId,
      { status: "cancelled" },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ message: "Order cancelled", order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { chefRouter };
