const service = require("../services/publicOrderService");
const { forwardError } = require("./controllerUtils");

const getQrMenu = async (req, res, next) => {
  try {
    res.json(await service.getQrMenu(req.params.tableId));
  } catch (err) {
    forwardError(next, err);
  }
};
const placeOrder = async (req, res, next) => {
  try {
    const result = await service.placePublicOrder(req.params.tableId, req.body, {
      io: req.app.get("io"),
    });
    res
      .status(201)
      .json({ message: "Order placed! Kitchen has been notified.", ...result });
  } catch (err) {
    forwardError(next, err);
  }
};
const getOrderStatus = async (req, res, next) => {
  try {
    res.json(await service.getPublicOrderStatus(req.params.orderId));
  } catch (err) {
    forwardError(next, err);
  }
};
module.exports = { getQrMenu, placeOrder, getOrderStatus };
