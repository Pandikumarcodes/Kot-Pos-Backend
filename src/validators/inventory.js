const {
  Joi,
  objectId,
  optionalText,
  requiredText,
  searchQuery,
} = require("./common");
const { validateRequest } = require("./validateRequest");

const UNITS = ["kg", "g", "l", "ml", "pcs", "dozen", "box", "packet"];
const CATEGORIES = [
  "raw_material",
  "beverage",
  "packaging",
  "dairy",
  "produce",
  "other",
];
const inventoryIdParams = Joi.object({ id: objectId("inventory item ID") });
const inventoryFields = {
  name: requiredText("Name", 150),
  unit: Joi.string()
    .valid(...UNITS)
    .optional(),
  currentStock: Joi.number().min(0).optional(),
  lowStockThreshold: Joi.number().min(0).optional(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .optional(),
  costPerUnit: Joi.number().min(0).optional(),
  supplier: optionalText(150),
  menuItemId: objectId("menu item ID").allow(null, "").optional(),
};
const createInventoryBody = Joi.object(inventoryFields);
const updateInventoryBody = Joi.object({
  ...inventoryFields,
  name: inventoryFields.name.optional(),
});
const restockBody = Joi.object({
  quantity: Joi.number().positive().required().messages({
    "any.required": "Quantity must be greater than 0",
    "number.base": "Quantity must be greater than 0",
    "number.positive": "Quantity must be greater than 0",
  }),
  note: optionalText(500),
});
const adjustBody = Joi.object({
  quantity: Joi.number().required().messages({
    "any.required": "Quantity is required",
    "number.base": "Quantity must be a number",
  }),
  note: optionalText(500),
});
const inventoryQuery = Joi.object({
  lowStock: Joi.string().valid("true", "false").optional(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .optional(),
  search: searchQuery,
});

module.exports = {
  validateInventoryAdjust: validateRequest({
    params: inventoryIdParams,
    body: adjustBody,
  }),
  validateInventoryCreate: validateRequest({ body: createInventoryBody }),
  validateInventoryId: validateRequest({ params: inventoryIdParams }),
  validateInventoryQuery: validateRequest({ query: inventoryQuery }),
  validateInventoryRestock: validateRequest({
    params: inventoryIdParams,
    body: restockBody,
  }),
  validateInventoryUpdate: validateRequest({
    params: inventoryIdParams,
    body: updateInventoryBody,
  }),
};
