const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const waiterOrderRouter = express.Router();

waiterOrderRouter.use(userAuth, allowRoles(["waiter"]));

waiterOrderRouter.post("/orders", (req, res) => {
  res.json({ message: "New table order created" });
});

waiterOrderRouter.get("/orders", (req, res) => {
  res.json({ message: "All table orders by this waiter" });
});
waiterOrderRouter.get("/orders/:orderId", (req, res) => {
  res.json({ message: "View single order details" });
});
waiterOrderRouter.put("/orders/:orderId/send", (req, res) => {
  res.json({ message: "Send order to kitchen (KOT)" });
});
waiterOrderRouter.put("/orders/:orderId/served", (req, res) => {
  res.json({ message: "Send order to kitchen (KOT)" });
});
waiterOrderRouter.delete("/orders/:orderId", (req, res) => {
  res.json({ message: "Send order to kitchen (KOT)" });
});

module.exports = { waiterOrderRouter };
