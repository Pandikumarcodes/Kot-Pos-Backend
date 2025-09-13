const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const cashierReportsRouter = express.Router();
cashierReportsRouter.use(userAuth, allowRoles(["cashier"]));

cashierReportsRouter.get("/income", (req, res) => {
  res.json({ message: "Total daily income" });
});
cashierReportsRouter.get(
  "/cashier/income/range?from=...&to=...",
  (req, res) => {
    res.json({ message: "Get income report between dates" });
  }
);
module.exports = { cashierReportsRouter };
