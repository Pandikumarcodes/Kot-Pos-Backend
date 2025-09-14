const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const Table = require("../../models/tables");
const waiterTableRouter = express.Router();

waiterTableRouter.use(userAuth, allowRoles(["waiter"]));

waiterTableRouter.post("/allocate/:tableId", async (req, res) => {
  try {
    const { name, phone } = req.body;
    const table = await Table.findById(req.params.tableId);
    if (!table) return res.status(404).json({ error: "Table not found" });
    if (table.status === "occupied")
      return res.status(400).json({ error: "Table is already occupied" });
    table.status = "occupied";
    table.currentCustomer = { name, phone };
    await table.save();
    res.status(200).json({ message: "Table allocated successfully", table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
waiterTableRouter.put("/free/:tableId", async (req, res) => {
  try {
    const table = await Table.findById(req.params.tableId);
    if (!table) return res.status(404).json({ error: "Table not found" });

    table.status = "available";
    table.currentCustomer = null;
    await table.save();

    res.status(200).json({ message: "Table is now available", table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { waiterTableRouter };
