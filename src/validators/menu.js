const { Joi, objectId, searchQuery } = require("./common");
const { validateRequest } = require("./validateRequest");

const MENU_CATEGORIES = [
  "starter", "main_course", "dessert", "beverage", "snacks",
  "side_dish", "bread", "rice", "combo", "special",
];

const itemName = Joi.string()
  .trim()
  .min(2)
  .max(150)
  .required()
  .custom((value, helpers) => {
    if (/<[^>]*>/g.test(value)) return helpers.error("itemName.html");
    if (/javascript\s*:/i.test(value)) return helpers.error("itemName.javascript");
    return value;
  })
  .messages({
    "any.required": "Item name must be at least 2 characters long",
    "string.empty": "Item name must be at least 2 characters long",
    "string.min": "Item name must be at least 2 characters long",
    "string.base": "Item name must be at least 2 characters long",
    "itemName.html": "HTML tags are not allowed in item name",
    "itemName.javascript": "Invalid characters in item name",
  });
const category = Joi.string()
  .valid(...MENU_CATEGORIES)
  .required()
  .messages({
    "any.only": `Category must be one of: ${MENU_CATEGORIES.join(", ")}`,
    "any.required": `Category must be one of: ${MENU_CATEGORIES.join(", ")}`,
  });
const price = Joi.number().strict().positive().required().messages({
  "number.base": "Price must be a positive number",
  "number.positive": "Price must be a positive number",
  "any.required": "Price must be a positive number",
});
const available = Joi.boolean().strict().messages({
  "boolean.base": "Available must be true or false",
});
const createMenuBody = Joi.object({
  ItemName: itemName,
  category,
  price,
  available: available.optional(),
});
const updateMenuBody = Joi.object({
  price: price.optional(),
  available: available.optional(),
});
const itemIdParams = Joi.object({ ItemId: objectId("menu item ID") });
const menuQuery = Joi.object({
  category: Joi.string().valid(...MENU_CATEGORIES).optional(),
  search: searchQuery,
});

module.exports = {
  MENU_CATEGORIES,
  createMenuBody,
  validateMenuCreate: validateRequest({ body: createMenuBody }),
  validateMenuId: validateRequest({ params: itemIdParams }),
  validateMenuQuery: validateRequest({ query: menuQuery }),
  validateMenuUpdate: validateRequest({
    params: itemIdParams,
    body: updateMenuBody,
  }),
};
