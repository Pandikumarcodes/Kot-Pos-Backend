const { Joi, objectId, optionalText, searchQuery } = require("./common");
const { validateRequest } = require("./validateRequest");
const { orderItems } = require("./orders");

const PAYMENT_STATUSES = ["unpaid", "paid"];
const PAYMENT_METHODS = ["cash", "card", "upi", "none"];
const billIdParams = Joi.object({ billId: objectId("Bill Id") });
const createBillBody = Joi.object({
  customerName: Joi.string().trim().min(1).max(150).required(),
  customerPhone: optionalText(30),
  items: orderItems,
  paymentStatus: Joi.string().valid(...PAYMENT_STATUSES).optional(),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS).optional(),
});
const payBillBody = Joi.object({
  paymentMethod: Joi.string()
    .valid("cash", "card", "upi")
    .allow(null)
    .optional(),
});
const billsQuery = Joi.object({
  status: Joi.string().valid(...PAYMENT_STATUSES).optional(),
  search: searchQuery,
});

module.exports = {
  validateBillCreate: validateRequest({ body: createBillBody }),
  validateBillId: validateRequest({ params: billIdParams }),
  validateBillsQuery: validateRequest({ query: billsQuery }),
  validateBillPayment: validateRequest({
    params: billIdParams,
    body: payBillBody,
  }),
};
