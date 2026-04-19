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
  return ["admin", "waiter", "chef", "cashier", "manager"].includes(role)
    ? role
    : "waiter";
};

const validateStatus = ({ status }) => {
  return ["active", "locked"].includes(status) ? status : "active";
};

const validateMenuData = (data) => {
  const { ItemName, category, price, available } = data;

  if (!ItemName || typeof ItemName !== "string" || ItemName.trim().length < 2) {
    throw new Error("Item name must be at least 2 characters long");
  }

  // ── Fix 1: Block XSS — reject HTML tags in item name ─────
  // Prevents Stored XSS attacks where scripts saved to DB
  // execute when staff view the menu page
  if (/<[^>]*>/g.test(ItemName)) {
    throw new Error("HTML tags are not allowed in item name");
  }

  // ── Fix 1b: Block dangerous JavaScript protocols ──────────
  if (/javascript\s*:/gi.test(ItemName)) {
    throw new Error("Invalid characters in item name");
  }

  // ✅ Matches model enum keys exactly
  const allowedCategories = [
    "starter",
    "main_course",
    "dessert",
    "beverage",
    "snacks",
    "side_dish",
    "bread",
    "rice",
    "combo",
    "special",
  ];

  if (!allowedCategories.includes(category)) {
    throw new Error(`Category must be one of: ${allowedCategories.join(", ")}`);
  }

  if (typeof price !== "number" || price <= 0) {
    throw new Error("Price must be a positive number");
  }

  if (available !== undefined && typeof available !== "boolean") {
    throw new Error("Available must be true or false");
  }
};

const validateBillingData = (data) => {
  const { paymentStatus, paymentMethod } = data;

  const allowedStatuses = ["paid", "pending", "due"];
  const allowedMethods = ["cash", "card", "upi"];

  if (paymentStatus && !allowedStatuses.includes(paymentStatus)) {
    throw new Error("Invalid paymentStatus");
  }
  if (paymentMethod && !allowedMethods.includes(paymentMethod)) {
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
