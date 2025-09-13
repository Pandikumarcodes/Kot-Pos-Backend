const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const MenuItem = require("../models/menuItems");
const { validateMenuData } = require("../utils/validation");

const adminMenuRouter = express.Router();

// Middleware: only admins can access these routes
adminMenuRouter.use(userAuth, allowRoles(["admin"]));

adminMenuRouter.post("/menu", async (req, res) => {
  console.log("📥 BODY RECEIVED:", req.body);

  try {
    validateMenuData(req.body);
    const { ItemName, category, price, available } = req.body;
    const existingItem = await MenuItem.findOne({ ItemName });
    if (existingItem) {
      return res.status(400).json({ error: "This Item already Exists" });
    }

    const menuItem = new MenuItem({
      ItemName,
      category,
      price,
      available,
    });

    await menuItem.save();

    res.status(201).json({
      message: "Menu item created successfully",
      menuItem: {
        id: menuItem._id,
        ItemName: menuItem.ItemName,
        category: menuItem.category,
        price: menuItem.status,
        available: menuItem.available,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
adminMenuRouter.get("/menuItems", async (req, res) => {
  try {
    const menuItems = await MenuItem.find();
    if (!menuItems.length) {
      return res.status(404).json({ error: "No users found" });
    }
    res.status(200).json({ menuItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
adminMenuRouter.put("/menu-item/:ItemId", async (req, res) => {
  try {
    const { ItemId } = req.params;
    const { price, available } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(ItemId)) {
      return res.status(400).json({ error: "Invalid menu item ID" });
    }

    // Validate fields
    if (price !== undefined && (typeof price !== "number" || price <= 0)) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    if (available !== undefined && typeof available !== "boolean") {
      return res.status(400).json({ error: "Available must be true or false" });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      ItemId,
      { price, available },
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    return res.status(200).json({
      message: "Menu item updated successfully",
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        available: menuItem.available,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

adminMenuRouter.delete("/delete/:ItemId", async (req, res) => {
  try {
    const { ItemId } = req.params;

    // Validate ObjectId
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
        id: deletedItem._id,
        name: deletedItem.ItemName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { adminMenuRouter };
