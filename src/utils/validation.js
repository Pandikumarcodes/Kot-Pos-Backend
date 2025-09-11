const validator = require("validator");

const validateSignupData = ({ username, password }) => {
  if (!username || !password) {
    throw new Error("Username and password are required");
  }
  if (!validator.isStrongPassword(password)) {
    throw new Error("Enter a strong password");
  }
};

const validateRole = ({ role }) => {
  return ["admin", "waiter", "chef"].includes(role) ? role : "waiter";
};

const validateStatus = ({ status }) => {
  return ["active", "locked"].includes(status) ? status : "active";
};

module.exports = {
  validateSignupData,
  validateStatus,
  validateRole,
};
