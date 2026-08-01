const Billing = require("../models/billings");
const Kot = require("../models/kot");
const TableOrder = require("../models/waiter");

const getDateRange = (range, from, to) => {
  const now = new Date();
  let start;
  let end;
  switch (range) {
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
    case "today":
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
  }
  return { start, end };
};

const getSummary = async ({ range = "today", from, to, branchMemberFilter, branchFilter }) => {
  const { start, end } = getDateRange(range, from, to);
  const [revenueResult, dineInCount, takeawayCount] = await Promise.all([
    Billing.aggregate([
      { $match: { ...branchMemberFilter, paymentStatus: "paid", createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    TableOrder.countDocuments({ ...branchMemberFilter, createdAt: { $gte: start, $lte: end } }),
    Kot.countDocuments({ ...branchFilter, orderType: "takeaway", createdAt: { $gte: start, $lte: end } }),
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;
  const totalBills = revenueResult[0]?.count || 0;
  return {
    totalRevenue,
    totalOrders: dineInCount + takeawayCount,
    totalBills,
    avgOrderValue: totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0,
    dineInCount,
    takeawayCount,
  };
};

const getTopItems = ({ range = "today", from, to, branchFilter }) => {
  const { start, end } = getDateRange(range, from, to);
  return Kot.aggregate([
    { $match: { ...branchFilter, createdAt: { $gte: start, $lte: end } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.name", quantity: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
    { $sort: { quantity: -1 } },
    { $limit: 10 },
    { $project: { name: "$_id", quantity: 1, revenue: 1, _id: 0 } },
  ]);
};

const getPayments = async ({ range = "today", from, to, branchMemberFilter }) => {
  const { start, end } = getDateRange(range, from, to);
  const payments = await Billing.aggregate([
    { $match: { ...branchMemberFilter, paymentStatus: "paid", createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$paymentMethod", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
    { $project: { method: "$_id", count: 1, amount: 1, _id: 0 } },
  ]);
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return payments.map((payment) => ({
    ...payment,
    percentage: total > 0 ? Math.round((payment.amount / total) * 100) : 0,
  }));
};

const getHourlySales = async ({ range = "today", from, to, branchMemberFilter }) => {
  const { start, end } = getDateRange(range, from, to);
  const hourly = await Billing.aggregate([
    { $match: { ...branchMemberFilter, paymentStatus: "paid", createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } }, orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
    { $sort: { _id: 1 } },
    { $project: { hour: "$_id", orders: 1, revenue: 1, _id: 0 } },
  ]);
  return hourly.map((entry) => ({
    hour: entry.hour < 12 ? `${entry.hour} AM` : entry.hour === 12 ? "12 PM" : `${entry.hour - 12} PM`,
    orders: entry.orders,
    revenue: entry.revenue,
  }));
};

const getCashierIncome = async (userId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const income = await Billing.aggregate([
    { $match: { createdAt: { $gte: todayStart }, createdBy: userId, paymentStatus: "paid" } },
    { $group: { _id: null, totalIncome: { $sum: "$totalAmount" } } },
  ]);
  return income[0]?.totalIncome || 0;
};

module.exports = { getDateRange, getSummary, getTopItems, getPayments, getHourlySales, getCashierIncome };
