const service = require("../services/takeawayOrderService");
const { forwardError } = require("./controllerUtils");

const createOrder = async (req, res, next) => {
  try {
    const order = await service.createTakeawayOrder(req.body, {
      userId: req.user._id,
      branchId: req.branchId,
    });
    res.status(201).json({ message: "Order created successfully", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const listOrders = async (req, res, next) => {
  try {
    const orders = await service.listTakeawayOrders(req.branchMemberFilter);
    res.status(200).json({ myOrders: orders || [] });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const getOrder = async (req, res, next) => {
  try {
    const order = await service.getTakeawayOrder(
      req.params.orderId,
      req.scopeToBranchMembers,
    );
    res.status(200).json({ message: "Single order", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const sendToKitchen = async (req, res, next) => {
  try {
    const order = await service.sendToKitchen(req.params.orderId, {
      scopeToBranchMembers: req.scopeToBranchMembers,
      branchId: req.branchId,
      io: req.app.get("io"),
    });
    res.status(200).json({ message: "Order sent to kitchen (KOT)", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const markReceived = async (req, res, next) => {
  try {
    const order = await service.updateStatus(
      req.params.orderId,
      "received",
      req.scopeToBranchMembers,
    );
    res.status(200).json({ message: "Order received successfully", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const cancelOrder = async (req, res, next) => {
  try {
    const order = await service.updateStatus(
      req.params.orderId,
      "cancelled",
      req.scopeToBranchMembers,
    );
    res.status(200).json({ message: "Order has been cancelled", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
module.exports = {
  createOrder,
  listOrders,
  getOrder,
  sendToKitchen,
  markReceived,
  cancelOrder,
};
