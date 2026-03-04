const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const MenuItem = require("../../models/menuItems");
const { validateMenuData } = require("../../utils/validation");

const adminMenuRouter = express.Router();

// Middleware: only admins can access these routes
adminMenuRouter.use(userAuth, allowRoles(["admin"]));

// ── CREATE ───────────────────────────────────────────────────
adminMenuRouter.post("/menu", async (req, res) => {
  console.log("📥 BODY RECEIVED:", req.body);
  try {
    validateMenuData(req.body);
    const { ItemName, category, price, available } = req.body;

    const existingItem = await MenuItem.findOne({ ItemName });
    if (existingItem) {
      return res.status(400).json({ error: "This Item already Exists" });
    }

    const menuItem = new MenuItem({ ItemName, category, price, available });
    await menuItem.save();

    res.status(201).json({
      message: "Menu item created successfully",
      menuItem: {
        _id: menuItem._id, // ✅ consistent _id
        ItemName: menuItem.ItemName,
        category: menuItem.category,
        price: menuItem.price, // ✅ fixed: was menuItem.status
        available: menuItem.available,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── READ ALL ─────────────────────────────────────────────────
adminMenuRouter.get("/menuItems", async (req, res) => {
  try {
    const menuItems = await MenuItem.find().lean(); // .lean() returns plain JS objects

    // ✅ Return empty array instead of 404 — frontend handles empty state
    res.status(200).json({ menuItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

// ── UPDATE (price + available only) ─────────────────────────
adminMenuRouter.put("/menu-item/:ItemId", async (req, res) => {
  try {
    const { ItemId } = req.params;
    const { price, available } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ItemId)) {
      return res.status(400).json({ error: "Invalid menu item ID" });
    }

    if (price !== undefined && (typeof price !== "number" || price <= 0)) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    if (available !== undefined && typeof available !== "boolean") {
      return res.status(400).json({ error: "Available must be true or false" });
    }

    // Build update object with only provided fields
    const updateFields = {};
    if (price !== undefined) updateFields.price = price;
    if (available !== undefined) updateFields.available = available;

    const menuItem = await MenuItem.findByIdAndUpdate(ItemId, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    return res.status(200).json({
      message: "Menu item updated successfully",
      menuItem: {
        _id: menuItem._id, // ✅ consistent _id
        ItemName: menuItem.ItemName, // ✅ fixed: was menuItem.name
        category: menuItem.category,
        price: menuItem.price,
        available: menuItem.available,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE ───────────────────────────────────────────────────
adminMenuRouter.delete("/delete/:ItemId", async (req, res) => {
  try {
    const { ItemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ItemId)) {
      return res.status(400).json({ error: "Invalid menu item ID" });
    }

    const deletedItem = await MenuItem.findByIdAndDelete(ItemId);

    if (!deletedItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.status(200).json({
      message: "Menu item deleted successfully",
      item: {
        _id: deletedItem._id, // ✅ consistent _id
        ItemName: deletedItem.ItemName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { adminMenuRouter };
