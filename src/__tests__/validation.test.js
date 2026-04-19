const {
  validateSignupData,
  validateRole,
  validateStatus,
  validateMenuData,
  validateBillingData,
} = require("../utils/validation");

// ─────────────────────────────────────────────────────────────
// validateSignupData
// ─────────────────────────────────────────────────────────────
describe("validateSignupData", () => {
  it("passes with valid username and strong password", () => {
    expect(() =>
      validateSignupData({ username: "pandikumar", password: "Test@1234!" }),
    ).not.toThrow();
  });

  it("throws when username is missing", () => {
    expect(() => validateSignupData({ password: "Test@1234!" })).toThrow(
      "Username and password are required",
    );
  });

  it("throws when password is missing", () => {
    expect(() => validateSignupData({ username: "pandikumar" })).toThrow(
      "Username and password are required",
    );
  });

  it("throws when both username and password are missing", () => {
    expect(() => validateSignupData({})).toThrow(
      "Username and password are required",
    );
  });

  it("throws when username is empty string", () => {
    expect(() =>
      validateSignupData({ username: "", password: "Test@1234!" }),
    ).toThrow("Username and password are required");
  });

  it("throws when password is empty string", () => {
    expect(() =>
      validateSignupData({ username: "pandikumar", password: "" }),
    ).toThrow("Username and password are required");
  });

  it("throws when password is weak (no special characters)", () => {
    expect(() =>
      validateSignupData({ username: "pandikumar", password: "password123" }),
    ).toThrow("Enter a strong password");
  });

  it("throws when password is too short", () => {
    expect(() =>
      validateSignupData({ username: "pandikumar", password: "Ab1!" }),
    ).toThrow("Enter a strong password");
  });

  it("throws when password has no uppercase", () => {
    expect(() =>
      validateSignupData({ username: "pandikumar", password: "test@1234!" }),
    ).toThrow("Enter a strong password");
  });

  it("throws when password has no numbers", () => {
    expect(() =>
      validateSignupData({ username: "pandikumar", password: "Test@abcd!" }),
    ).toThrow("Enter a strong password");
  });
});

// ─────────────────────────────────────────────────────────────
// validateRole
// ─────────────────────────────────────────────────────────────
describe("validateRole", () => {
  it('returns "admin" for valid role admin', () => {
    expect(validateRole({ role: "admin" })).toBe("admin");
  });

  it('returns "waiter" for valid role waiter', () => {
    expect(validateRole({ role: "waiter" })).toBe("waiter");
  });

  it('returns "chef" for valid role chef', () => {
    expect(validateRole({ role: "chef" })).toBe("chef");
  });

  it('returns "cashier" for valid role cashier', () => {
    expect(validateRole({ role: "cashier" })).toBe("cashier");
  });

  it('returns "manager" for valid role manager', () => {
    expect(validateRole({ role: "manager" })).toBe("manager");
  });

  it('defaults to "waiter" for unknown role', () => {
    expect(validateRole({ role: "superuser" })).toBe("waiter");
  });

  it('defaults to "waiter" when role is undefined', () => {
    expect(validateRole({})).toBe("waiter");
  });

  it('defaults to "waiter" when role is empty string', () => {
    expect(validateRole({ role: "" })).toBe("waiter");
  });

  it('defaults to "waiter" when role is null', () => {
    expect(validateRole({ role: null })).toBe("waiter");
  });

  it("is case-sensitive — rejects uppercase role", () => {
    expect(validateRole({ role: "Admin" })).toBe("waiter");
  });
});

// ─────────────────────────────────────────────────────────────
// validateStatus
// ─────────────────────────────────────────────────────────────
describe("validateStatus", () => {
  it('returns "active" for valid status active', () => {
    expect(validateStatus({ status: "active" })).toBe("active");
  });

  it('returns "locked" for valid status locked', () => {
    expect(validateStatus({ status: "locked" })).toBe("locked");
  });

  it('defaults to "active" for unknown status', () => {
    expect(validateStatus({ status: "banned" })).toBe("active");
  });

  it('defaults to "active" when status is undefined', () => {
    expect(validateStatus({})).toBe("active");
  });

  it('defaults to "active" when status is empty string', () => {
    expect(validateStatus({ status: "" })).toBe("active");
  });

  it('defaults to "active" when status is null', () => {
    expect(validateStatus({ status: null })).toBe("active");
  });

  it("is case-sensitive — rejects uppercase status", () => {
    expect(validateStatus({ status: "Active" })).toBe("active");
  });
});

// ─────────────────────────────────────────────────────────────
// validateMenuData
// ─────────────────────────────────────────────────────────────
describe("validateMenuData", () => {
  // valid base data reused across tests
  const validItem = {
    ItemName: "Paneer Butter Masala",
    category: "main_course",
    price: 280,
    available: true,
  };

  it("passes with all valid fields", () => {
    expect(() => validateMenuData(validItem)).not.toThrow();
  });

  it("passes when available is false", () => {
    expect(() =>
      validateMenuData({ ...validItem, available: false }),
    ).not.toThrow();
  });

  it("passes when available is omitted (optional field)", () => {
    const { available, ...withoutAvailable } = validItem;
    expect(() => validateMenuData(withoutAvailable)).not.toThrow();
  });

  // ── ItemName ──
  it("throws when ItemName is missing", () => {
    expect(() =>
      validateMenuData({ ...validItem, ItemName: undefined }),
    ).toThrow("Item name must be at least 2 characters long");
  });

  it("throws when ItemName is too short (1 char)", () => {
    expect(() => validateMenuData({ ...validItem, ItemName: "A" })).toThrow(
      "Item name must be at least 2 characters long",
    );
  });

  it("throws when ItemName is empty string", () => {
    expect(() => validateMenuData({ ...validItem, ItemName: "" })).toThrow(
      "Item name must be at least 2 characters long",
    );
  });

  it("throws when ItemName is not a string", () => {
    expect(() => validateMenuData({ ...validItem, ItemName: 123 })).toThrow(
      "Item name must be at least 2 characters long",
    );
  });

  it("passes when ItemName is exactly 2 characters", () => {
    expect(() =>
      validateMenuData({ ...validItem, ItemName: "Ab" }),
    ).not.toThrow();
  });

  // ── category ──
  it("passes for all allowed categories", () => {
    const categories = [
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
    categories.forEach((category) => {
      expect(() => validateMenuData({ ...validItem, category })).not.toThrow();
    });
  });

  it("throws for invalid category", () => {
    expect(() => validateMenuData({ ...validItem, category: "pizza" })).toThrow(
      "Category must be one of:",
    );
  });

  it("throws when category is undefined", () => {
    expect(() =>
      validateMenuData({ ...validItem, category: undefined }),
    ).toThrow("Category must be one of:");
  });

  // ── price ──
  it("throws when price is zero", () => {
    expect(() => validateMenuData({ ...validItem, price: 0 })).toThrow(
      "Price must be a positive number",
    );
  });

  it("throws when price is negative", () => {
    expect(() => validateMenuData({ ...validItem, price: -50 })).toThrow(
      "Price must be a positive number",
    );
  });

  it("throws when price is a string", () => {
    expect(() => validateMenuData({ ...validItem, price: "280" })).toThrow(
      "Price must be a positive number",
    );
  });

  it("throws when price is undefined", () => {
    expect(() => validateMenuData({ ...validItem, price: undefined })).toThrow(
      "Price must be a positive number",
    );
  });

  it("passes with decimal price", () => {
    expect(() =>
      validateMenuData({ ...validItem, price: 99.99 }),
    ).not.toThrow();
  });

  // ── available ──
  it("throws when available is a string", () => {
    expect(() => validateMenuData({ ...validItem, available: "true" })).toThrow(
      "Available must be true or false",
    );
  });

  it("throws when available is a number", () => {
    expect(() => validateMenuData({ ...validItem, available: 1 })).toThrow(
      "Available must be true or false",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// validateBillingData
// ─────────────────────────────────────────────────────────────
describe("validateBillingData", () => {
  it("passes with valid paymentStatus and paymentMethod", () => {
    expect(() =>
      validateBillingData({ paymentStatus: "paid", paymentMethod: "cash" }),
    ).not.toThrow();
  });

  it("passes when both fields are omitted (optional)", () => {
    expect(() => validateBillingData({})).not.toThrow();
  });

  it("passes when only paymentStatus is provided", () => {
    expect(() =>
      validateBillingData({ paymentStatus: "pending" }),
    ).not.toThrow();
  });

  it("passes when only paymentMethod is provided", () => {
    expect(() => validateBillingData({ paymentMethod: "upi" })).not.toThrow();
  });

  // ── paymentStatus ──
  it('passes for status "paid"', () => {
    expect(() => validateBillingData({ paymentStatus: "paid" })).not.toThrow();
  });

  it('passes for status "pending"', () => {
    expect(() =>
      validateBillingData({ paymentStatus: "pending" }),
    ).not.toThrow();
  });

  it('passes for status "due"', () => {
    expect(() => validateBillingData({ paymentStatus: "due" })).not.toThrow();
  });

  it("throws for invalid paymentStatus", () => {
    expect(() => validateBillingData({ paymentStatus: "refunded" })).toThrow(
      "Invalid paymentStatus",
    );
  });

  // ── paymentMethod ──
  it('passes for method "cash"', () => {
    expect(() => validateBillingData({ paymentMethod: "cash" })).not.toThrow();
  });

  it('passes for method "card"', () => {
    expect(() => validateBillingData({ paymentMethod: "card" })).not.toThrow();
  });

  it('passes for method "upi"', () => {
    expect(() => validateBillingData({ paymentMethod: "upi" })).not.toThrow();
  });

  it("throws for invalid paymentMethod", () => {
    expect(() => validateBillingData({ paymentMethod: "crypto" })).toThrow(
      "Invalid paymentMethod",
    );
  });

  it("throws for invalid paymentMethod even with valid status", () => {
    expect(() =>
      validateBillingData({ paymentStatus: "paid", paymentMethod: "crypto" }),
    ).toThrow("Invalid paymentMethod");
  });

  it("throws for invalid paymentStatus even with valid method", () => {
    expect(() =>
      validateBillingData({ paymentStatus: "refunded", paymentMethod: "cash" }),
    ).toThrow("Invalid paymentStatus");
  });
});
