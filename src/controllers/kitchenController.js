const service = require("../services/kitchenService");
const { forwardError } = require("./controllerUtils");

const listActiveOrders = async (req, res, next) => {
  try {
    const { branchId: _branchId, ...query } = req.query;
    const result = await service.listActiveOrders(req.scopeToBranch, query);
    res.json({
      KotOrders: result.items,
      ...(result.pagination && { pagination: result.pagination }),
    });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const getOrder = async (req, res, next) => {
  try {
    res.json({
      order: await service.getOrder(req.params.orderId, req.scopeToBranch),
    });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const update = (status, message) => async (req, res, next) => {
  try {
    const order = await service.updateOrderStatus(
      req.params.orderId,
      status,
      req.scopeToBranch,
      req.app.get("io"),
    );
    res.json({ message, order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const startOrder = update("preparing", "Order marked as preparing");
const markReady = update("ready", "Order marked as ready");
const cancelOrder = update("cancelled", "Order cancelled");
module.exports = {
  listActiveOrders,
  getOrder,
  startOrder,
  markReady,
  cancelOrder,
};
