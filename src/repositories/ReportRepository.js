const Billing = require("../models/billings");
const Kot = require("../models/kot");
const TableOrder = require("../models/waiter");

const aggregate = (Model, pipeline, options) =>
  Object.keys(options).length > 0
    ? Model.aggregate(pipeline, options)
    : Model.aggregate(pipeline);

const countDocuments = (Model, filter, options) =>
  Object.keys(options).length > 0
    ? Model.countDocuments(filter, options)
    : Model.countDocuments(filter);

const getRevenueSummary = (filter, options = {}) =>
  aggregate(Billing, [
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ], options);

const countDineInOrders = (filter, options = {}) =>
  countDocuments(TableOrder, filter, options);

const countKitchenOrders = (filter, options = {}) =>
  countDocuments(Kot, filter, options);

const getTopItems = (filter, options = {}) =>
  aggregate(Kot, [
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
  ], options);

const getPayments = (filter, options = {}) =>
  aggregate(Billing, [
    { $match: filter },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        amount: { $sum: "$totalAmount" },
      },
    },
    { $project: { method: "$_id", count: 1, amount: 1, _id: 0 } },
  ], options);

const getHourlySales = (filter, options = {}) =>
  aggregate(Billing, [
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
  ], options);

const getCashierIncome = (filter, options = {}) =>
  aggregate(Billing, [
    { $match: filter },
    { $group: { _id: null, totalIncome: { $sum: "$totalAmount" } } },
  ], options);

module.exports = {
  getRevenueSummary,
  countDineInOrders,
  countKitchenOrders,
  getTopItems,
  getPayments,
  getHourlySales,
  getCashierIncome,
};
