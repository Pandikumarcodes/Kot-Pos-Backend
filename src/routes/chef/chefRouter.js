const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const chefRouter = express.Router();
chefRouter.use(userAuth, allowRoles(["chef"]));

chefRouter.get("/orders", (req, res) => {
  res.json({ message: "View all pending KOT orders" });
});

chefRouter.put("/orders/:orderId/status", (req, res) => {
  res.json({ message: "Order marked as prepared" });
});

module.exports = { chefRouter };
