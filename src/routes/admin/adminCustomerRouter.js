const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const Customer = require("../../models/customer");
const adminCustomerRouter = express.Router();

adminCustomerRouter.use(userAuth, allowRoles(["admin", "manager"]));

// ── GET ALL CUSTOMERS ─────────────────────────────────────────
adminCustomerRouter.get("/customers", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ lastVisit: -1 });
    res.status(200).json({ customers: customers || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET SINGLE CUSTOMER ───────────────────────────────────────
adminCustomerRouter.get("/customers/:customerId", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.status(200).json({ customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE CUSTOMER ───────────────────────────────────────────
adminCustomerRouter.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }
    const existing = await Customer.findOne({ phone });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Customer with this phone already exists" });
    }
    const customer = await Customer.create({ name, phone, email, address });
    res.status(201).json({ message: "Customer created", customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE CUSTOMER ───────────────────────────────────────────
adminCustomerRouter.put("/customers/:customerId", async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.customerId)) {
      return res.status(400).json({ error: "Invalid customer ID" });
    }
    const customer = await Customer.findByIdAndUpdate(
      req.params.customerId,
      { name, phone, email, address },
      { new: true, runValidators: true },
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.status(200).json({ message: "Customer updated", customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE CUSTOMER — admin only ──────────────────────────────
adminCustomerRouter.delete(
  "/customers/:customerId",
  userAuth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }
      const customer = await Customer.findByIdAndDelete(req.params.customerId);
      if (!customer)
        return res.status(404).json({ error: "Customer not found" });
      res.status(200).json({ message: "Customer deleted", customer });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = { adminCustomerRouter };
