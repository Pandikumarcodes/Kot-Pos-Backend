const Billing = require("../models/billings");
const Kot = require("../models/kot");
const TableOrder = require("../models/waiter");

const getRevenueSummary = (filter) =>
  Billing.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

const countDineInOrders = (filter) => TableOrder.countDocuments(filter);

const countKitchenOrders = (filter) => Kot.countDocuments(filter);

const getTopItems = (filter) =>
  Kot.aggregate([
    { $match: filter },
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

const getPayments = (filter) =>
  Billing.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        amount: { $sum: "$totalAmount" },
      },
    },
    { $project: { method: "$_id", count: 1, amount: 1, _id: 0 } },
  ]);

const getHourlySales = (filter) =>
  Billing.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          $hour: { date: "$createdAt", timezone: "Asia/Kolkata" },
        },
        orders: { $sum: 1 },
        revenue: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { hour: "$_id", orders: 1, revenue: 1, _id: 0 } },
  ]);

const getCashierIncome = (filter) =>
  Billing.aggregate([
    { $match: filter },
    { $group: { _id: null, totalIncome: { $sum: "$totalAmount" } } },
  ]);

module.exports = {
  getRevenueSummary,
  countDineInOrders,
  countKitchenOrders,
  getTopItems,
  getPayments,
  getHourlySales,
  getCashierIncome,
};
