const { Joi, objectId } = require("./common");
const { validateRequest } = require("./validateRequest");
const { signupBody } = require("./authentication");

const ROLES = ["superadmin", "admin", "manager", "waiter", "chef", "cashier"];
const STAFF_ROLES = ROLES.filter((role) => role !== "superadmin");
const BRANCH_STAFF_ROLES = ["manager", "waiter", "chef", "cashier"];
const STATUSES = ["active", "locked"];

const createUserBody = signupBody.keys({
  role: Joi.string()
    .custom((value, helpers) => {
      if (value === "superadmin") {
        return helpers.message({ custom: "Superadmin cannot be created through the staff API" });
      }
      if (value === "admin") {
        return helpers.message({ custom: "Admin cannot be created through the staff API" });
      }
      return BRANCH_STAFF_ROLES.includes(value) ? value : "waiter";
    })
    .default("waiter"),
  status: Joi.string()
    .custom((value) => (STATUSES.includes(value) ? value : "active"))
    .default("active"),
});
const roleBody = Joi.object({
  role: Joi.string()
    .valid(...STAFF_ROLES)
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
  STAFF_ROLES,
  BRANCH_STAFF_ROLES,
  validateCreateUser: validateRequest({ body: createUserBody }),
  validateRoleUpdate: validateRequest({
    params: userIdParams,
    body: roleBody,
  }),
  validateUserId: validateRequest({ params: userIdParams }),
};
