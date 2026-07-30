const { Joi, objectId } = require("./common");
const { validateRequest } = require("./validateRequest");
const { signupBody } = require("./authentication");

const ROLES = ["admin", "chef", "waiter", "cashier", "manager"];
const STATUSES = ["active", "locked"];

const createUserBody = signupBody.keys({
  role: Joi.string()
    .custom((value) => (ROLES.includes(value) ? value : "waiter"))
    .default("waiter"),
  status: Joi.string()
    .custom((value) => (STATUSES.includes(value) ? value : "active"))
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
