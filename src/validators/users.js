const { Joi, objectId } = require("./common");
const { validateRequest } = require("./validateRequest");
const { signupBody } = require("./authentication");

const ROLES = ["admin", "chef", "waiter", "cashier", "manager"];
const STATUSES = ["active", "locked"];

const createUserBody = signupBody.keys({
  role: Joi.string()
    .valid(...ROLES)
    .messages({ "any.only": "Invalid role" })
    .default("waiter"),
  status: Joi.string()
    .valid(...STATUSES)
    .messages({ "any.only": "Invalid status" })
    .default("active"),
});
const roleBody = Joi.object({
  role: Joi.string()
    .valid(...ROLES)
    .required()
    .messages({
      "any.required": "Role is required",
      "string.empty": "Role is required",
      "any.only": "Invalid role",
    }),
});
const userIdParams = Joi.object({ userId: objectId("userId") });

module.exports = {
  ROLES,
  validateCreateUser: validateRequest({ body: createUserBody }),
  validateRoleUpdate: validateRequest({
    params: userIdParams,
    body: roleBody,
  }),
  validateUserId: validateRequest({ params: userIdParams }),
};
