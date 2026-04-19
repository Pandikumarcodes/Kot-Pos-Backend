const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock entire inventory controller ──────────────────────────
jest.mock("../../controllers/inventoryController", () => ({
  getInventory: jest.fn((req, res) => res.status(200).json({ inventory: [] })),
  createInventory: jest.fn((req, res) =>
    res.status(201).json({ message: "Item created" }),
  ),
  updateInventory: jest.fn((req, res) =>
    res.status(200).json({ message: "Item updated" }),
  ),
  restockItem: jest.fn((req, res) =>
    res.status(200).json({ message: "Item restocked" }),
  ),
  adjustStock: jest.fn((req, res) =>
    res.status(200).json({ message: "Stock adjusted" }),
  ),
  getStockLogs: jest.fn((req, res) => res.status(200).json({ logs: [] })),
  deleteInventory: jest.fn((req, res) =>
    res.status(200).json({ message: "Item deleted" }),
  ),
  deductStockForKot: jest.fn().mockResolvedValue(true),
}));

const User = require("../../models/users");
const inventoryRouter = require("../../routes/admin/InventoryRouter");

const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();
const VALID_ITEM_ID = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin/inventory", inventoryRouter);

function makeToken(role = "admin", branchId = VALID_BRANCH_ID) {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "admin", branchId = VALID_BRANCH_ID) {
  return { _id: "user_id_123", username: "testuser", role, branchId };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/inventory
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/inventory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch inventory", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .get("/api/v1/admin/inventory")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.inventory).toBeDefined();
  });

  it("200 — manager can fetch inventory", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));

    const res = await request(app)
      .get("/api/v1/admin/inventory")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/inventory");
    expect(res.status).toBe(401);
  });

  it("403 — non-admin with no branchId is blocked by branchScope", async () => {
    const token = jwt.sign(
      { _id: "user_id", username: "waiter", role: "waiter", branchId: null },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    User.findById.mockResolvedValue({
      _id: "user_id",
      role: "waiter",
      branchId: null,
    });

    const res = await request(app)
      .get("/api/v1/admin/inventory")
      .set("Cookie", `token=${token}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/inventory
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/inventory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 — admin can create an inventory item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .post("/api/v1/admin/inventory")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ name: "Tomatoes", unit: "kg", currentStock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Item created");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/inventory")
      .send({ name: "Tomatoes" });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/inventory/:id
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/inventory/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can update an inventory item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .put(`/api/v1/admin/inventory/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ currentStock: 20 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Item updated");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/admin/inventory/${VALID_ITEM_ID}`)
      .send({ currentStock: 20 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/inventory/:id/restock
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/inventory/:id/restock", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can restock an item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .post(`/api/v1/admin/inventory/${VALID_ITEM_ID}/restock`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ quantity: 50 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Item restocked");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/inventory/${VALID_ITEM_ID}/restock`)
      .send({ quantity: 50 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/inventory/:id/adjust
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/inventory/:id/adjust", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can adjust stock", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .post(`/api/v1/admin/inventory/${VALID_ITEM_ID}/adjust`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ quantity: -5, reason: "Spoilage" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Stock adjusted");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/inventory/${VALID_ITEM_ID}/adjust`)
      .send({ quantity: -5 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/inventory/:id/logs
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/inventory/:id/logs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch stock logs", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .get(`/api/v1/admin/inventory/${VALID_ITEM_ID}/logs`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(
      `/api/v1/admin/inventory/${VALID_ITEM_ID}/logs`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/inventory/:id
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/admin/inventory/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can delete an inventory item", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .delete(`/api/v1/admin/inventory/${VALID_ITEM_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Item deleted");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).delete(
      `/api/v1/admin/inventory/${VALID_ITEM_ID}`,
    );
    expect(res.status).toBe(401);
  });
});
