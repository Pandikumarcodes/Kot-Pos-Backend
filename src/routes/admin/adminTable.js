const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const Table = require("../../models/tables");

const adminTableRouter = express.Router();

// ── CREATE — admin + manager only ───────────────────────────
adminTableRouter.post(
  "/tables",
  userAuth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
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
      res.status(500).json({ error: err.message });
    }
  },
);

// ── READ ALL — admin + manager + waiter ─────────────────────
// ✅ waiter needs this to see the tables page
adminTableRouter.get(
  "/tables",
  userAuth,
  allowRoles(["admin", "manager", "waiter", "cashier"]),
  async (req, res) => {
    try {
      const tables = await Table.find();
      res.status(200).json({ tables });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── READ ONE — admin + manager + waiter ─────────────────────
// ✅ waiter needs this for the order page
adminTableRouter.get(
  "/tables/:id",
  userAuth,
  allowRoles(["admin", "manager", "waiter", "cashier"]),
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ error: "Table not found" });
      res.status(200).json({ table });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── UPDATE — admin + manager only ───────────────────────────
adminTableRouter.put(
  "/tables/:id",
  userAuth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const { capacity, status } = req.body;
      const table = await Table.findByIdAndUpdate(
        req.params.id,
        { capacity, status },
        { new: true, runValidators: true },
      );
      if (!table) return res.status(404).json({ error: "Table not found" });
      res.status(200).json({ message: "Table updated", table });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── DELETE — admin only ──────────────────────────────────────
adminTableRouter.delete(
  "/tables/:id",
  userAuth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      const deleted = await Table.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Table not found" });
      res.status(200).json({ message: "Table deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = { adminTableRouter };
