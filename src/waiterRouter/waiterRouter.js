const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const waiterRouter = express.Router();

waiterRouter.use(userAuth, allowRoles(["waiter"]));

waiterRouter.post("/orders", (req, res) => {
  res.json({ message: "New table order created" });
});

waiterRouter.get("/orders", (req, res) => {
  res.json({ message: "All table orders by this waiter" });
});
waiterRouter.get("/orders/:orderId", (req, res) => {
  res.json({ message: "View single order details" });
});
waiterRouter.put("/orders/:orderId/send", (req, res) => {
  res.json({ message: "Send order to kitchen (KOT)" });
});
waiterRouter.put("/orders/:orderId/served", (req, res) => {
  res.json({ message: "Send order to kitchen (KOT)" });
});
waiterRouter.delete("/orders/:orderId", (req, res) => {
  res.json({ message: "Send order to kitchen (KOT)" });
});

module.exports = { waiterRouter };
