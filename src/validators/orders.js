const { Joi, objectId, optionalText } = require("./common");
const { validateRequest } = require("./validateRequest");

const orderItem = Joi.object({
  itemId: objectId("itemId").messages({
    "any.required": "itemId is required for each item",
    "string.empty": "itemId is required for each item",
  }),
  quantity: Joi.number().positive().required(),
});
const orderItems = Joi.array().items(orderItem).min(1).required().messages({
  "any.required": "Items are required",
  "array.min": "Items are required",
});
const orderIdParams = Joi.object({ orderId: objectId("order ID") });
const tableIdParams = Joi.object({ tableId: objectId("table ID") });
const customerFields = {
  customerName: optionalText(150),
  customerPhone: optionalText(30),
};
const waiterOrderBody = Joi.object({
  ...customerFields,
  tableId: objectId("tableId").messages({
    "any.required": "tableId and items are required",
    "string.empty": "tableId and items are required",
  }),
  tableNumber: Joi.number().optional(),
  items: orderItems.messages({
    "any.required": "tableId and items are required",
    "array.min": "tableId and items are required",
  }),
});
const takeawayBody = Joi.object({
  customerName: Joi.string().trim().min(1).max(150).required(),
  customerPhone: Joi.string()
    .trim()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Enter a valid 10-digit phone number",
    }),
  items: orderItems,
});
const publicOrderBody = Joi.object({
  ...customerFields,
  items: orderItems.messages({
    "any.required": "No items in order",
    "array.min": "No items in order",
  }),
});
const sendToCashierBody = Joi.object({
  ...customerFields,
  tableNumber: Joi.number().allow(null).optional(),
});

module.exports = {
  orderItem,
  orderItems,
  validateOrderId: validateRequest({ params: orderIdParams }),
  validatePublicOrder: validateRequest({
    params: tableIdParams,
    body: publicOrderBody,
  }),
  validateSendToCashier: validateRequest({
    params: tableIdParams,
    body: sendToCashierBody,
  }),
  validateTableId: validateRequest({ params: tableIdParams }),
  validateTakeawayCreate: validateRequest({ body: takeawayBody }),
  validateWaiterOrderCreate: validateRequest({ body: waiterOrderBody }),
};
