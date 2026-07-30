const Joi = require("joi");

const objectId = (label = "ID") =>
  Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      "any.required": `${label} is required`,
      "string.empty": `${label} is required`,
      "string.pattern.base": `Invalid ${label}`,
    });

const optionalText = (max = 500) =>
  Joi.string().trim().max(max).allow("").optional();

const requiredText = (label, max = 500) =>
  Joi.string().trim().min(1).max(max).required().messages({
    "any.required": `${label} is required`,
    "string.empty": `${label} is required`,
  });

const searchQuery = Joi.string().trim().max(100).allow("").optional();

module.exports = { Joi, objectId, optionalText, requiredText, searchQuery };
