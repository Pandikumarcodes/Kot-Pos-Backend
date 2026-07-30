const { Joi, objectId, optionalText, requiredText } = require("./common");
const { validateRequest } = require("./validateRequest");

const customerIdParams = Joi.object({
  customerId: objectId("customer ID"),
});
const customerFields = {
  name: requiredText("Name", 150).messages({
    "any.required": "Name and phone are required",
    "string.empty": "Name and phone are required",
  }),
  phone: requiredText("Phone", 30).messages({
    "any.required": "Name and phone are required",
    "string.empty": "Name and phone are required",
  }),
  email: Joi.string().trim().email().max(254).allow("").optional(),
  address: optionalText(500),
};
const createCustomerBody = Joi.object(customerFields);
const updateCustomerBody = Joi.object({
  ...customerFields,
  name: customerFields.name.optional(),
  phone: customerFields.phone.optional(),
});

module.exports = {
  validateCustomerCreate: validateRequest({ body: createCustomerBody }),
  validateCustomerId: validateRequest({ params: customerIdParams }),
  validateCustomerUpdate: validateRequest({
    params: customerIdParams,
    body: updateCustomerBody,
  }),
};
