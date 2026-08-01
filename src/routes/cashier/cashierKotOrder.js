const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { branchMemberScope, requireBranch } = branchScope;
const controller = require("../../controllers/takeawayOrderController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateOrderId,
  validateTakeawayCreate,
} = require("../../validators/orders");

const cashierKotRouter = express.Router();
cashierKotRouter.use(
  userAuth,
  allowRoles(["cashier", "admin", "manager"]),
  branchScope,
  branchMemberScope,
);
cashierKotRouter.post(
  "/takeaway-orders",
  requireBranch,
  validateTakeawayCreate,
  controller.createOrder,
);
cashierKotRouter.get("/takeaway-orders", controller.listOrders);
cashierKotRouter.get(
  "/takeaway/:orderId",
  validateOrderId,
  controller.getOrder,
);
cashierKotRouter.put(
  "/takeaway/:orderId/send",
  validateOrderId,
  controller.sendToKitchen,
);
cashierKotRouter.put(
  "/takeaway/:orderId/received",
  validateOrderId,
  controller.markReceived,
);
cashierKotRouter.put(
  "/takeaway/:orderId/cancel",
  validateOrderId,
  controller.cancelOrder,
);
cashierKotRouter.use(handleControllerError);

module.exports = { cashierKotRouter };
