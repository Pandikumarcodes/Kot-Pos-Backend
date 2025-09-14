const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const Table = require("../../models/tables");
const adminTableRouter = express.Router();

// Middleware: only admins can access these routes
adminTableRouter.use(userAuth, allowRoles(["admin"]));

adminTableRouter.post("/tables", async (req, res) => {
  try {
    const { tableNumber, capacity } = req.body;

    const exists = await Table.findOne({ tableNumber });
    if (exists) {
      return res.status(400).json({ error: "Table number already exists" });
    }

    const table = new Table({ tableNumber, capacity });
    await table.save();

    res.status(201).json({ message: "Table created", table });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

adminTableRouter.get("/tables", async (req, res) => {
  try {
    const tables = await Table.find();
    res.status(200).json({ tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminTableRouter.get("/tables/:id", async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: "Table not found" });
    res.status(200).json({ table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
adminTableRouter.put("/tables/:id", async (req, res) => {
  try {
    const { capacity, status } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { capacity, status },
      { new: true, runValidators: true }
    );
    if (!table) return res.status(404).json({ error: "Table not found" });
    res.status(200).json({ message: "Table updated", table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminTableRouter.delete("/tables/:id", async (req, res) => {
  try {
    const deleted = await Table.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Table not found" });
    res.status(200).json({ message: "Table deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { adminTableRouter };
