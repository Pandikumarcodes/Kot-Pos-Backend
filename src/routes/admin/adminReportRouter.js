const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const adminReportRouter = express.Router();
const Billing = require("../../models/billings");
const Kot = require("../../models/kot");
const TableOrder = require("../../models/waiter");

adminReportRouter.use(userAuth, allowRoles(["admin", "manager"]));

// ── HELPER: get date range ────────────────────────────────────
function getDateRange(range, from, to) {
  const now = new Date();
  let start, end;

  switch (range) {
    case "today":
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    case "week":
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    case "month":
      start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    case "custom":
      start = from ? new Date(from) : new Date(now.setHours(0, 0, 0, 0));
      end = to ? new Date(to) : new Date();
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

// ── GET SUMMARY STATS ─────────────────────────────────────────
// GET /admin/reports/summary?range=today|week|month|custom&from=&to=
adminReportRouter.get("/reports/summary", async (req, res) => {
  try {
    const { range = "today", from, to } = req.query;
    const { start, end } = getDateRange(range, from, to);

    // Total revenue from paid bills
    const revenueResult = await Billing.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Total dine-in orders
    const dineInCount = await TableOrder.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    // Total takeaway orders
    const takeawayCount = await Kot.countDocuments({
      orderType: "takeaway",
      createdAt: { $gte: start, $lte: end },
    });

    const totalRevenue = revenueResult[0]?.total || 0;
    const totalBills = revenueResult[0]?.count || 0;
    const totalOrders = dineInCount + takeawayCount;
    const avgOrderValue =
      totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;

    res.json({
      totalRevenue,
      totalOrders,
      totalBills,
      avgOrderValue,
      dineInCount,
      takeawayCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TOP SELLING ITEMS ─────────────────────────────────────────
// GET /admin/reports/top-items?range=today|week|month
adminReportRouter.get("/reports/top-items", async (req, res) => {
  try {
    const { range = "today", from, to } = req.query;
    const { start, end } = getDateRange(range, from, to);

    const topItems = await Kot.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
      { $project: { name: "$_id", quantity: 1, revenue: 1, _id: 0 } },
    ]);

    res.json({ topItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PAYMENT METHODS ───────────────────────────────────────────
// GET /admin/reports/payments?range=today|week|month
adminReportRouter.get("/reports/payments", async (req, res) => {
  try {
    const { range = "today", from, to } = req.query;
    const { start, end } = getDateRange(range, from, to);

    const payments = await Billing.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          amount: { $sum: "$totalAmount" },
        },
      },
      { $project: { method: "$_id", count: 1, amount: 1, _id: 0 } },
    ]);

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    const result = payments.map((p) => ({
      ...p,
      percentage: total > 0 ? Math.round((p.amount / total) * 100) : 0,
    }));

    res.json({ payments: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SALES BY HOUR ─────────────────────────────────────────────
// GET /admin/reports/hourly?range=today|week|month
adminReportRouter.get("/reports/hourly", async (req, res) => {
  try {
    const { range = "today", from, to } = req.query;
    const { start, end } = getDateRange(range, from, to);

    const hourly = await Billing.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { hour: "$_id", orders: 1, revenue: 1, _id: 0 } },
    ]);

    // Format hour labels
    const result = hourly.map((h) => ({
      hour:
        h.hour < 12
          ? `${h.hour} AM`
          : h.hour === 12
            ? "12 PM"
            : `${h.hour - 12} PM`,
      orders: h.orders,
      revenue: h.revenue,
    }));

    res.json({ hourly: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { adminReportRouter };
