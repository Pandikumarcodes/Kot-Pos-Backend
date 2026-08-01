const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { branchMemberScope, requireBranch } = branchScope;
const controller = require("../../controllers/waiterorderControllers");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateMenuQuery } = require("../../validators/menu");
const {
  validateOrderId,
  validateSendToCashier,
  validateTableId,
  validateWaiterOrderCreate,
} = require("../../validators/orders");

const waiterOrderRouter = express.Router();
waiterOrderRouter.use(
  userAuth,
  allowRoles(["waiter", "manager", "admin", "cashier"]),
  branchScope,
  branchMemberScope,
);
waiterOrderRouter.get("/menu", validateMenuQuery, controller.getMenu);
waiterOrderRouter.get(
  "/orders/table/:tableId",
  validateTableId,
  controller.getTableOrders,
);
waiterOrderRouter.post(
  "/orders/table/:tableId/send-to-cashier",
  requireBranch,
  validateSendToCashier,
  controller.sendToCashier,
);
waiterOrderRouter.post(
  "/orders",
  requireBranch,
  validateWaiterOrderCreate,
  controller.createOrder,
);
waiterOrderRouter.get("/orders", controller.getOrders);
waiterOrderRouter.get("/orders/:orderId", validateOrderId, controller.getOrder);
waiterOrderRouter.put(
  "/orders/:orderId/send",
  requireBranch,
  validateOrderId,
  controller.sendToKitchen,
);
waiterOrderRouter.put(
  "/orders/:orderId/served",
  validateOrderId,
  controller.markServed,
);
waiterOrderRouter.put(
  "/orders/:orderId/cancel",
  validateOrderId,
  controller.cancelOrder,
);
waiterOrderRouter.use(handleControllerError);

module.exports = { waiterOrderRouter };
