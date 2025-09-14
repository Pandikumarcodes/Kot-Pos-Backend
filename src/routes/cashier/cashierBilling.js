const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const Billing = require("../../models/billings");
const MenuItem = require("../../models/menuItems");

const cashierbillingRouter = express.Router();
cashierbillingRouter.use(userAuth, allowRoles(["cashier"]));

cashierbillingRouter.post("/billing", async (req, res) => {
  try {
    console.log("📥 Received Body:", req.body);
    const {
      customerName,
      customerPhone,
      items,
      paymentStatus,
      paymentMethod,
      // shopName,
      // shopAddress,
    } = req.body;

    // validateBillingData(req.body);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    // Get today's date part like "20250914"
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

    // Count how many bills created today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await Billing.countDocuments({
      createdAt: { $gte: todayStart },
    });

    const billNumber = `BILL-${today}-${(todayCount + 1)
      .toString()
      .padStart(3, "0")}`;

    const detailedItems = [];
    for (const i of items) {
      if (!i.itemId) {
        return res
          .status(400)
          .json({ error: "itemId is required for each item" });
      }

      const menuItem = await MenuItem.findById(i.itemId);
      if (!menuItem) {
        return res
          .status(404)
          .json({ error: `Menu item not found for ID: ${i.itemId}` });
      }
      detailedItems.push({
        itemId: menuItem._id,
        name: menuItem.ItemName,
        quantity: i.quantity,
        price: menuItem.price,
        total: menuItem.price * i.quantity,
      });
    }
    const totalAmount = detailedItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const newBill = new Billing({
      billNumber,
      customerName,
      customerPhone,
      items: detailedItems,
      totalAmount,
      paymentStatus,
      paymentMethod,
      // shopName: req.user.shopName,
      // shopAddress: req.user.shopAddress,
      createdBy: req.user._id,
    });

    await newBill.save();

    res.status(201).json({
      message: "Bill generated successfully",
      bill: newBill,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

cashierbillingRouter.get("/bills", async (req, res) => {
  try {
    const myBills = await Billing.find({ createdBy: req.user._id }).sort({
      createdAt: -1,
    });
    if (!myBills.length) {
      return res.status(404).json({ error: "No Bills found" });
    }
    res.status(200).json({ myBills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Bills" });
  }
});

cashierbillingRouter.get("/bills/:billId", async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Billing.findOne({
      _id: billId,
      createdBy: req.user._id,
    });
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    res.status(200).json({ bill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Bill" });
  }
  res.json({ message: "Get single bill details" });
});

cashierbillingRouter.put("/bills/:billId/pay", async (req, res) => {
  try {
    const { billId } = req.params;

    // Find the bill created by this cashier
    const bill = await Billing.findOne({
      _id: billId,
      createdBy: req.user._id,
    });

    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (bill.paymentStatus === "paid")
      return res.status(400).json({ error: "Bill is already paid" });

    // Update payment status to "paid"
    bill.paymentStatus = "paid";
    bill.paidAt = new Date();

    await bill.save();

    res.status(200).json({
      message: "Bill marked as paid successfully",
      bill,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update bill payment status" });
  }
});

cashierbillingRouter.delete("/bills/:billId", async (req, res) => {
  try {
    const { billId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({ error: "Invalid Bill Id" });
    }

    const deletedBill = await Billing.findOneAndDelete({
      _id: billId,
      createdBy: req.user._id,
    });
    if (!deletedBill) {
      return res
        .status(404)
        .json({ error: "Bill not found or not authorized" });
    }
    return res.status(200).json({
      message: "Bill deleted successfully",
      Bill: {
        id: deletedBill._id,
        customerName: deletedBill.customerName,
        totalAmount: deletedBill.totalAmount,
        billNumber: deletedBill.billNumber,
      },
    });
  } catch (err) {
    console.error(err); // show real error in console
    res.status(500).json({ error: err.message });
  }
});

module.exports = { cashierbillingRouter };
