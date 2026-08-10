const service = require("../services/waiterOrderService");
const menuService = require("../services/menuService");
const { forwardError } = require("./controllerUtils");

const getMenu = async (req, res, next) => {
  try {
    const menuItems = await menuService.listAvailableMenu(req.query);
    res.status(200).json({ menuItems });
  } catch (err) {
    forwardError(next, err);
  }
};
const getTableOrders = async (req, res, next) => {
  try {
    res
      .status(200)
      .json(
        await service.getTableOrders(
          req.params.tableId,
          req.branchId,
          req.scopeToBranchMembers,
        ),
      );
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const sendToCashier = async (req, res, next) => {
  try {
    const bill = await service.sendToCashier(req.params.tableId, req.body, {
      scopeToBranchMembers: req.scopeToBranchMembers,
      branchId: req.branchId,
      userId: req.user._id,
      io: req.app.get("io"),
    });
    res.status(201).json({ message: "Bill sent to cashier", bill });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const createOrder = async (req, res, next) => {
  try {
    const order = await service.createOrder(req.body, {
      branchId: req.branchId,
      userId: req.user._id,
    });
    res.status(201).json({ message: "Order created successfully", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const getOrders = async (req, res, next) => {
  try {
    const { branchId: _branchId, ...query } = req.query;
    const result = await service.listOrders(req.branchMemberFilter, query);
    res.status(200).json({
      myOrders: result.items,
      ...(result.pagination && { pagination: result.pagination }),
    });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const getOrder = async (req, res, next) => {
  try {
    res.status(200).json({
      order: await service.getOrder(
        req.params.orderId,
        req.scopeToBranchMembers,
      ),
    });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const sendToKitchen = async (req, res, next) => {
  try {
    const order = await service.sendToKitchen(req.params.orderId, {
      scopeToBranchMembers: req.scopeToBranchMembers,
      branchId: req.branchId,
      userId: req.user._id,
      actorRole: req.user.role,
      io: req.app.get("io"),
    });
    res.status(200).json({ message: "Order sent to kitchen (KOT)", order });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const markServed = async (req, res, next) => {
  try {
    const order = await service.updateStatus(
      req.params.orderId,
      "served",
      req.scopeToBranchMembers,
    );
    res.status(200).json({ message: "Order marked as served", order });
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
  getMenu,
  getTableOrders,
  sendToCashier,
  createOrder,
  getOrders,
  getOrder,
  sendToKitchen,
  markServed,
  cancelOrder,
};
