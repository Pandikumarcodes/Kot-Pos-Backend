const kitchenRepository = require("../repositories/KitchenRepository");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");

const listActiveOrders = (scopeToBranch) =>
  kitchenRepository.listActive(
    scopeToBranch({ status: { $in: ["pending", "preparing", "ready"] } }),
  );

const getOrder = async (orderId, scopeToBranch) => {
  const order = await kitchenRepository.findScoped(
    scopeToBranch({ _id: orderId }),
  );
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const updateOrderStatus = async (orderId, status, scopeToBranch, io) => {
  const order = await kitchenRepository.updateStatus(
    scopeToBranch({ _id: orderId }),
    status,
  );
  if (!order) throw new AppError("Order not found", 404);
  notify.kotUpdated(io, order);
  return order;
};

module.exports = { listActiveOrders, getOrder, updateOrderStatus };
