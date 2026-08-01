const express = require("express");
const controller = require("../../controllers/publicOrderController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateOrderId, validatePublicOrder, validateTableId } = require("../../validators/orders");

const router = express.Router();
router.get("/menu/:tableId", validateTableId, controller.getQrMenu);
router.post("/order/:tableId", validatePublicOrder, controller.placeOrder);
router.get("/order/:orderId/status", validateOrderId, controller.getOrderStatus);
router.use(handleControllerError);

module.exports = router;
