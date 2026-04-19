const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/users");
jest.mock("../../models/menuItems");

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock validation ───────────────────────────────────────────
jest.mock("../../utils/validation", () => ({
  validateMenuData: jest.fn(), // no-op by default, throws when needed
}));

const User = require("../../models/users");
const MenuItem = require("../../models/menuItems");
const { validateMenuData } = require("../../utils/validation");
const { adminMenuRouter } = require("../../routes/admin/adminMenu");

// ── Build minimal Express app ─────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminMenuRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeToken(role = "admin") {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "admin") {
  return { _id: "user_id_123", username: "testuser", role };
}

const VALID_ITEM_ID = new mongoose.Types.ObjectId().toString();

const validMenuItem = {
  ItemName: "Paneer Butter Masala",
  category: "main_course",
  price: 280,
  available: true,
};

function mockMenuDoc(overrides = {}) {
  return {
    _id: VALID_ITEM_ID,
    ItemName: "Paneer Butter Masala",
    category: "main_course",
    price: 280,
    available: true,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/menu
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/menu", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 — admin can create a menu item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findOne.mockResolvedValue(null); // not a duplicate
    const saved = mockMenuDoc();
    MenuItem.mockImplementation(() => saved);

    const res = await request(app)
      .post("/api/v1/admin/menu")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validMenuItem);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Menu item created successfully");
    expect(res.body.menuItem).toMatchObject({
      ItemName: "Paneer Butter Masala",
      category: "main_course",
      price: 280,
    });
  });

  it("201 — manager can create a menu item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    MenuItem.findOne.mockResolvedValue(null);
    MenuItem.mockImplementation(() => mockMenuDoc());

    const res = await request(app)
      .post("/api/v1/admin/menu")
      .set("Cookie", `token=${makeToken("manager")}`)
      .send(validMenuItem);

    expect(res.status).toBe(201);
  });

  it("400 — rejects duplicate menu item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findOne.mockResolvedValue(mockMenuDoc()); // already exists

    const res = await request(app)
      .post("/api/v1/admin/menu")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validMenuItem);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("This Item already Exists");
  });

  it("400 — rejects invalid menu data (validateMenuData throws)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    validateMenuData.mockImplementationOnce(() => {
      throw new Error("Price must be a positive number");
    });

    const res = await request(app)
      .post("/api/v1/admin/menu")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ ...validMenuItem, price: -10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
  });

  it("401 — rejects request with no token", async () => {
    const res = await request(app)
      .post("/api/v1/admin/menu")
      .send(validMenuItem);

    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot create a menu item (restricted to admin/manager)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/admin/menu")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validMenuItem);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/menuItems
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/menuItems", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch all menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockMenuDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/admin/menuItems")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.menuItems).toHaveLength(1);
    expect(res.body.menuItems[0].ItemName).toBe("Paneer Butter Masala");
  });

  it("200 — waiter can fetch menu items (needed for orders)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockMenuDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/admin/menuItems")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
  });

  it("200 — chef can fetch menu items (needed for KOT)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    MenuItem.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const res = await request(app)
      .get("/api/v1/admin/menuItems")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.menuItems).toHaveLength(0);
  });

  it("200 — cashier can fetch menu items (needed for billing)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockMenuDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/admin/menuItems")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
  });

  it("200 — returns empty array when no items exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const res = await request(app)
      .get("/api/v1/admin/menuItems")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.menuItems).toEqual([]);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/menuItems");
    expect(res.status).toBe(401);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error("DB error")),
    });

    const res = await request(app)
      .get("/api/v1/admin/menuItems")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch menu items");
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/menu-item/:ItemId
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/menu-item/:ItemId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can update price", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findByIdAndUpdate.mockResolvedValue(mockMenuDoc({ price: 350 }));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ price: 350 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Menu item updated successfully");
    expect(res.body.menuItem.price).toBe(350);
  });

  it("200 — admin can update availability", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findByIdAndUpdate.mockResolvedValue(
      mockMenuDoc({ available: false }),
    );

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ available: false });

    expect(res.status).toBe(200);
    expect(res.body.menuItem.available).toBe(false);
  });

  it("200 — manager can update menu item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    MenuItem.findByIdAndUpdate.mockResolvedValue(mockMenuDoc({ price: 300 }));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ price: 300 });

    expect(res.status).toBe(200);
  });

  it("400 — rejects invalid ObjectId", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .put("/api/v1/admin/menu-item/invalid_id")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ price: 350 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid menu item ID");
  });

  it("400 — rejects negative price", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ price: -50 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
  });

  it("400 — rejects zero price", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ price: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Price must be a positive number");
  });

  it("400 — rejects non-boolean available", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ available: "yes" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Available must be true or false");
  });

  it("404 — returns 404 when item does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ price: 350 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Menu item not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .send({ price: 350 });

    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot update menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ price: 350 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — chef cannot update menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`)
      .send({ price: 350 });

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot update menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .put(`/api/v1/admin/menu-item/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ price: 350 });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/delete/:ItemId
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/admin/delete/:ItemId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can delete a menu item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findByIdAndDelete.mockResolvedValue(mockMenuDoc());

    const res = await request(app)
      .delete(`/api/v1/admin/delete/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Menu item deleted successfully");
    expect(res.body.item.ItemName).toBe("Paneer Butter Masala");
  });

  it("400 — rejects invalid ObjectId", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .delete("/api/v1/admin/delete/invalid_id")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid menu item ID");
  });

  it("404 — returns 404 when item does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    MenuItem.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/admin/delete/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Menu item not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).delete(
      `/api/v1/admin/delete/${VALID_ITEM_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — manager cannot delete menu items (admin only)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));

    const res = await request(app)
      .delete(`/api/v1/admin/delete/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — waiter cannot delete menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .delete(`/api/v1/admin/delete/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot delete menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .delete(`/api/v1/admin/delete/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot delete menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .delete(`/api/v1/admin/delete/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });
});
