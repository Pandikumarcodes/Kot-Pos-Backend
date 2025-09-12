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

module.exports = { waiterRouter };
