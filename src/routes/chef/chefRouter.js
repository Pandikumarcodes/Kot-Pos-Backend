const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { allowGlobalOrSelectedBranch, requireBranchScope } = require("../../middlewares/accessScope");
const controller = require("../../controllers/kitchenController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateOrderId } = require("../../validators/orders");

const chefRouter = express.Router();
chefRouter.use(userAuth, allowRoles(["chef", "admin", "manager"]), allowGlobalOrSelectedBranch, requireBranchScope);
chefRouter.get("/kot", controller.listActiveOrders);
chefRouter.get("/kot/:orderId", validateOrderId, controller.getOrder);
chefRouter.put("/kot/:orderId/start", validateOrderId, controller.startOrder);
chefRouter.put("/kot/:orderId/ready", validateOrderId, controller.markReady);
chefRouter.put("/kot/:orderId/cancel", validateOrderId, controller.cancelOrder);
chefRouter.use(handleControllerError);

module.exports = { chefRouter };
