const Kot = require("../models/kot");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");

const listActiveOrders = (scopeToBranch) =>
  Kot.find(scopeToBranch({ status: { $in: ["pending", "preparing", "ready"] } })).sort({ createdAt: 1 });

const getOrder = async (orderId, scopeToBranch) => {
  const order = await Kot.findOne(scopeToBranch({ _id: orderId }));
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const updateOrderStatus = async (orderId, status, scopeToBranch, io) => {
  const order = await Kot.findOneAndUpdate(
    scopeToBranch({ _id: orderId }),
    { status },
    { new: true },
  );
  if (!order) throw new AppError("Order not found", 404);
  notify.kotUpdated(io, order);
  return order;
};

module.exports = { listActiveOrders, getOrder, updateOrderStatus };
