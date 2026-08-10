const { Joi, objectId, optionalText, requiredText } = require("./common");
const { validateRequest } = require("./validateRequest");
const validator = require("validator");

const branchIdParams = Joi.object({ id: objectId("branch ID") });
const branchFields = {
  name: requiredText("Branch name", 150),
  address: optionalText(500),
  phone: optionalText(30),
  email: Joi.string().trim().email().max(254).allow("").optional(),
  gstin: optionalText(30),
};
const createBranchBody = Joi.object(branchFields);
const updateBranchBody = Joi.object({
  ...branchFields,
  name: branchFields.name.optional(),
  isActive: Joi.boolean().optional(),
});
const staffBody = Joi.object({ userId: objectId("userId") });
const branchAdminBody = Joi.object({ userId: objectId("userId") });
const createBranchAdminBody = Joi.object({
  username: requiredText("Username", 254),
  password: Joi.string()
    .min(5)
    .max(72)
    .required()
    .custom((value, helpers) =>
      validator.isStrongPassword(value)
        ? value
        : helpers.message({ custom: "Enter a strong password" }),
    )
    .messages({
    "any.required": "Password is required",
    "string.empty": "Password is required",
  }),
  status: Joi.string().valid("active", "locked").default("active"),
});

module.exports = {
  validateBranchCreate: validateRequest({ body: createBranchBody }),
  validateBranchId: validateRequest({ params: branchIdParams }),
  validateBranchStaff: validateRequest({
    params: branchIdParams,
    body: staffBody,
  }),
  validateBranchAdminAssignment: validateRequest({
    params: branchIdParams,
    body: branchAdminBody,
  }),
  validateBranchAdminCreate: validateRequest({
    params: branchIdParams,
    body: createBranchAdminBody,
  }),
  validateBranchUpdate: validateRequest({
    params: branchIdParams,
    body: updateBranchBody,
  }),
};
