const Billing = require("../models/billings");
const Kot = require("../models/kot");
const TableOrder = require("../models/waiter");

class ReportRepository {
  getRevenueSummary(filter) {
    return Billing.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]);
  }

  countDineInOrders(filter) {
    return TableOrder.countDocuments(filter);
  }

  countKitchenOrders(filter) {
    return Kot.countDocuments(filter);
  }

  getTopItems(filter) {
    return Kot.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", quantity: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
      { $project: { name: "$_id", quantity: 1, revenue: 1, _id: 0 } },
    ]);
  }

  getPayments(filter) {
    return Billing.aggregate([
      { $match: filter },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
      { $project: { method: "$_id", count: 1, amount: 1, _id: 0 } },
    ]);
  }

  getHourlySales(filter) {
    return Billing.aggregate([
      { $match: filter },
      { $group: { _id: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } }, orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
      { $sort: { _id: 1 } },
      { $project: { hour: "$_id", orders: 1, revenue: 1, _id: 0 } },
    ]);
  }

  getCashierIncome(filter) {
    return Billing.aggregate([
      { $match: filter },
      { $group: { _id: null, totalIncome: { $sum: "$totalAmount" } } },
    ]);
  }
}

module.exports = new ReportRepository();
module.exports.ReportRepository = ReportRepository;
