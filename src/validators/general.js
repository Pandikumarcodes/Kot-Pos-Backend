const { Joi, optionalText } = require("./common");
const { validateRequest } = require("./validateRequest");

const reportQuery = Joi.object({
  range: Joi.string().valid("today", "week", "month", "custom").optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref("from")).optional(),
});
const settingsBody = Joi.object({
  branchId: Joi.any().strip(),
  businessName: optionalText(150),
  email: Joi.string().trim().email().max(254).allow("").optional(),
  phone: optionalText(30),
  address: optionalText(500),
  gstin: optionalText(30),
  currency: optionalText(10),
  timezone: optionalText(100),
  openTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  closeTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  avgServiceTime: Joi.number().min(0).optional(),
  maxCapacity: Joi.number().integer().min(0).optional(),
  takeawayEnabled: Joi.boolean().optional(),
  deliveryEnabled: Joi.boolean().optional(),
  taxRate: Joi.number().min(0).optional(),
  fssai: optionalText(30),
  hsn: optionalText(30),
  serviceCharge: Joi.number().min(0).optional(),
  autoRoundOff: Joi.boolean().optional(),
  printReceipt: Joi.boolean().optional(),
  paymentMethods: Joi.object({
    cash: Joi.boolean().optional(),
    card: Joi.boolean().optional(),
    upi: Joi.boolean().optional(),
  }).optional(),
  orderAlerts: Joi.boolean().optional(),
  lowStockAlerts: Joi.boolean().optional(),
  emailNotifications: Joi.boolean().optional(),
});
const aiChatBody = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required().messages({
    "any.required": "Message is required",
    "string.empty": "Message is required",
  }),
  context: Joi.object().optional(),
});

module.exports = {
  validateAiChat: validateRequest({ body: aiChatBody }),
  validateReportQuery: validateRequest({ query: reportQuery }),
  validateSettingsUpdate: validateRequest({ body: settingsBody }),
};
