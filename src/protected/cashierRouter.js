const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const cashierRouter = express.Router();
cashierRouter.use(userAuth, allowRoles(["cashier"]));

cashierRouter.post("/billing", (req, res) => {
  res.json({ message: "Bill generated" });
});

cashierRouter.get("/income", (req, res) => {
  res.json({ message: "Total daily income" });
});

cashierRouter.post("/online-order", (req, res) => {
  res.json({ message: "Online order placed" });
});

cashierRouter.post("/send-to-kitchen/:orderId", (req, res) => {
  res.json({ message: "Order sent to kitchen" });
});

module.exports = { cashierRouter };
