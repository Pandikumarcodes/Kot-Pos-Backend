const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const cashierKotRouter = express.Router();
cashierKotRouter.use(userAuth, allowRoles(["cashier"]));

cashierKotRouter.post("/send-to-kitchen/:orderId", (req, res) => {
  res.json({ message: "Order sent to kitchen" });
});

module.exports = { cashierKotRouter };
