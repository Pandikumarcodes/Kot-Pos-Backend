const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const cashierbillingRouter = express.Router();
cashierbillingRouter.use(userAuth, allowRoles(["cashier"]));

cashierbillingRouter.post("/billing", (req, res) => {
  res.json({ message: "Bill generated" });
});
cashierbillingRouter.get("/cashier/bills", (req, res) => {
  res.json({ message: "Get list of all bills" });
});
cashierbillingRouter.get("/cashier/bills/:billId", (req, res) => {
  res.json({ message: "Get single bill details" });
});
cashierbillingRouter.put("/cashier/bills/:billId/pay", (req, res) => {
  res.json({ message: "Mark bill as paid" });
});
cashierbillingRouter.delete("/cashier/bills/:billId", (req, res) => {
  res.json({ message: "Delete bill" });
});

module.exports = { cashierbillingRouter };
