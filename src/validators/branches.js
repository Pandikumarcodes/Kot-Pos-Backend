const { Joi, objectId, optionalText, requiredText } = require("./common");
const { validateRequest } = require("./validateRequest");

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

module.exports = {
  validateBranchCreate: validateRequest({ body: createBranchBody }),
  validateBranchId: validateRequest({ params: branchIdParams }),
  validateBranchStaff: validateRequest({
    params: branchIdParams,
    body: staffBody,
  }),
  validateBranchUpdate: validateRequest({
    params: branchIdParams,
    body: updateBranchBody,
  }),
};
