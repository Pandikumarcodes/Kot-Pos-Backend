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
  return ["admin", "waiter", "chef", "cashier,manager"].includes(role)
    ? role
    : "waiter";
};

const validateStatus = ({ status }) => {
  return ["active", "locked"].includes(status) ? status : "active";
};

const validateMenuData = (data) => {
  const { ItemName, category, price, available } = data;

  // Validate name
  if (!ItemName || typeof ItemName !== "string" || ItemName.trim().length < 2) {
    throw new Error("Item name must be at least 2 characters long");
  }

  // Validate category
  const allowedCategories = ["starter", "main", "dessert", "beverage"];
  if (!allowedCategories.includes(category)) {
    throw new Error(`Category must be one of: ${allowedCategories.join(", ")}`);
  }

  // Validate price
  if (typeof price !== "number" || price <= 0) {
    throw new Error("Price must be a positive number");
  }

  // Validate available
  if (available !== undefined && typeof available !== "boolean") {
    throw new Error("Available must be true or false");
  }
};

module.exports = {
  validateSignupData,
  validateStatus,
  validateRole,
  validateMenuData,
};
