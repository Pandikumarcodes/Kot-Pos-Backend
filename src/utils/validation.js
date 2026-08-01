const validator = require("validator");
const { createMenuBody } = require("../validators/menu");

// Backward-compatible utility exports. Request handlers now use middleware from
// src/validators; these functions remain for non-HTTP callers and older tests.
const validateSignupData = ({ username, password }) => {
  if (!username || !password) {
    throw new Error("Username and password are required");
  }
  if (!validator.isStrongPassword(password)) {
    throw new Error("Enter a strong password");
  }
};

const validateRole = ({ role }) =>
  ["admin", "waiter", "chef", "cashier", "manager"].includes(role)
    ? role
    : "waiter";

const validateStatus = ({ status }) =>
  ["active", "locked"].includes(status) ? status : "active";

const validateMenuData = (data) => {
  const { error } = createMenuBody.validate(data, {
    abortEarly: true,
    allowUnknown: true,
    convert: false,
  });
  if (error) throw new Error(error.details[0].message.replace(/"/g, ""));
};

const validateBillingData = ({ paymentStatus, paymentMethod }) => {
  if (paymentStatus && !["paid", "pending", "due"].includes(paymentStatus)) {
    throw new Error("Invalid paymentStatus");
  }
  if (paymentMethod && !["cash", "card", "upi"].includes(paymentMethod)) {
    throw new Error("Invalid paymentMethod");
  }
};

module.exports = {
  validateSignupData,
  validateStatus,
  validateRole,
  validateMenuData,
  validateBillingData,
};
