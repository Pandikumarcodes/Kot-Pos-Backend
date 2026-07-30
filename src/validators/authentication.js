const { Joi } = require("./common");
const { validateRequest } = require("./validateRequest");
const { validateSignupData } = require("../utils/validation");

const byteLimitedPassword = Joi.string()
  .required()
  .custom((value, helpers) =>
    Buffer.byteLength(value, "utf8") <= 72
      ? value
      : helpers.error("password.bytes"),
  );

const credentials = Joi.object({
  username: Joi.string().trim().max(254).required(),
  password: byteLimitedPassword,
}).messages({
  "any.required": "Username and password are required",
  "string.empty": "Username and password are required",
  "string.max": "Invalid username or password",
  "password.bytes": "Password must not exceed 72 bytes",
});

const signupBody = credentials
  .keys({
    password: byteLimitedPassword,
    role: Joi.any().optional(),
    status: Joi.string()
      .custom((value) =>
        ["active", "locked"].includes(value) ? value : "active",
      )
      .default("active"),
  })
  .messages({
    "password.bytes": "Password must not exceed 72 bytes",
  });

const validateSignupSchema = validateRequest({ body: signupBody });
const validateSignup = (req, res, next) => {
  try {
    validateSignupData(req.body);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      validationErrors: [
        {
          field: "",
          location: "body",
          message: error.message,
          type: "custom",
        },
      ],
    });
  }
  return validateSignupSchema(req, res, next);
};

module.exports = {
  credentials,
  signupBody,
  validateLogin: validateRequest({ body: credentials }),
  validateSignup,
};
