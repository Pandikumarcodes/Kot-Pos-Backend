const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { branchMemberScope, requireBranch } = branchScope;
const Billing = require("../../models/billings");
const MenuItem = require("../../models/menuItems");
const Table = require("../../models/tables");
const {
  validateBillCreate,
  validateBillId,
  validateBillsQuery,
  validateBillPayment,
} = require("../../validators/billing");

// ── Notification service ──────────────────────────────────────
const { notify } = require("../../services/notificationservices");

const cashierbillingRouter = express.Router();

// Add branchScope so req.branchId is available
cashierbillingRouter.use(
  userAuth,
  allowRoles(["cashier", "admin", "manager"]),
  branchScope,
  branchMemberScope,
);

// ── CREATE BILL ───────────────────────────────────────────────
cashierbillingRouter.post(
  "/billing",
  requireBranch,
  validateBillCreate,
  async (req, res) => {
  try {
    const { customerName, customerPhone, items, paymentStatus, paymentMethod } =
      req.body;

    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
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
      0,
    );

    const newBill = new Billing({
      billNumber,
      customerName,
      customerPhone,
      items: detailedItems,
      totalAmount,
      paymentStatus,
      paymentMethod,
      createdBy: req.user._id,
    });

    await newBill.save();

    const io = req.app.get("io");
    notify.billingUpdated(io, newBill, req.branchId);

    res
      .status(201)
      .json({ message: "Bill generated successfully", bill: newBill });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
  },
);

// ── GET ALL BILLS ─────────────────────────────────────────────
cashierbillingRouter.get("/bills", validateBillsQuery, async (req, res) => {
  try {
    const filter = {};

    // Optional filters
    if (req.query.status) filter.paymentStatus = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { customerName: { $regex: req.query.search, $options: "i" } },
        { customerPhone: { $regex: req.query.search, $options: "i" } },
        { billNumber: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const myBills = await Billing.find(req.scopeToBranchMembers(filter))
      .populate("createdBy", "username role")
      .sort({ createdAt: -1 });

    if (!myBills.length) {
      return res.status(404).json({ error: "No Bills found" });
    }
    res.status(200).json({ myBills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Bills" });
  }
});

// ── GET SINGLE BILL ───────────────────────────────────────────
cashierbillingRouter.get(
  "/bills/:billId",
  validateBillId,
  async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await Billing.findOne(
      req.scopeToBranchMembers({ _id: billId }),
    ).populate("createdBy", "username role");
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    res.status(200).json({ bill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Bill" });
  }
  },
);

// ── MARK PAID ─────────────────────────────────────────────────

cashierbillingRouter.put(
  "/bills/:billId/pay",
  validateBillPayment,
  async (req, res) => {
  try {
    const { billId } = req.params;
    const paymentMethod = req.body?.paymentMethod ?? null;

    const bill = await Billing.findOne(
      req.scopeToBranchMembers({ _id: billId }),
    );
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (bill.paymentStatus === "paid")
      return res.status(400).json({ error: "Bill is already paid" });

    bill.paymentStatus = "paid";
    bill.paidAt = new Date();
    // Update payment method if cashier provides one
    if (paymentMethod) bill.paymentMethod = paymentMethod;
    await bill.save();

    // FIX: Free the table so it shows as available again
    if (bill.tableId) {
      await Table.findByIdAndUpdate(bill.tableId, {
        status: "available",
        currentCustomer: null,
      });
    }

    const io = req.app.get("io");
    notify.billingUpdated(io, bill, req.branchId);

    res.status(200).json({ message: "Bill marked as paid successfully", bill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update bill payment status" });
  }
  },
);

// ── DELETE BILL ───────────────────────────────────────────────
cashierbillingRouter.delete(
  "/bills/:billId",
  validateBillId,
  async (req, res) => {
  try {
    const { billId } = req.params;
    const deletedBill = await Billing.findOneAndDelete(
      req.scopeToBranchMembers({ _id: billId }),
    );
    if (!deletedBill) {
      return res.status(404).json({ error: "Bill not found" });
    }
    return res.status(200).json({
      message: "Bill deleted successfully",
      bill: {
        id: deletedBill._id,
        customerName: deletedBill.customerName,
        totalAmount: deletedBill.totalAmount,
        billNumber: deletedBill.billNumber,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
  },
);

module.exports = { cashierbillingRouter };
