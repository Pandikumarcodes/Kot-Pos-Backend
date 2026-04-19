const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/users");
jest.mock("../../models/tables");

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../../models/users");
const Table = require("../../models/tables");
const { adminTableRouter } = require("../../routes/admin/adminTable");

// ── Build minimal Express app ─────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminTableRouter);

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

const VALID_TABLE_ID = new mongoose.Types.ObjectId().toString();

function mockTableDoc(overrides = {}) {
  return {
    _id: VALID_TABLE_ID,
    tableNumber: 1,
    capacity: 4,
    status: "available",
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/tables
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/tables", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 — admin can create a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findOne.mockResolvedValue(null);
    const saved = mockTableDoc();
    Table.mockImplementation(() => saved);

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Table created");
    expect(res.body.table).toMatchObject({ tableNumber: 1, capacity: 4 });
  });

  it("201 — manager can create a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Table.findOne.mockResolvedValue(null);
    Table.mockImplementation(() => mockTableDoc());

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ tableNumber: 2, capacity: 2 });

    expect(res.status).toBe(201);
  });

  it("400 — rejects duplicate table number", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findOne.mockResolvedValue(mockTableDoc()); // already exists

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Table number already exists");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/tables")
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot create a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — chef cannot create a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("chef")}`)
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot create a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws on save", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findOne.mockResolvedValue(null);
    Table.mockImplementation(() => ({
      ...mockTableDoc(),
      save: jest.fn().mockRejectedValue(new Error("DB error")),
    }));

    const res = await request(app)
      .post("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ tableNumber: 1, capacity: 4 });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/tables
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/tables", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch all tables", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.find.mockResolvedValue([mockTableDoc()]);

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.tables).toHaveLength(1);
    expect(res.body.tables[0].tableNumber).toBe(1);
  });

  it("200 — manager can fetch all tables", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Table.find.mockResolvedValue([mockTableDoc()]);

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("200 — waiter can fetch all tables", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.find.mockResolvedValue([mockTableDoc()]);

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
  });

  it("200 — cashier can fetch all tables", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Table.find.mockResolvedValue([mockTableDoc()]);

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
  });

  it("200 — returns empty array when no tables exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.find.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.tables).toEqual([]);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/tables");
    expect(res.status).toBe(401);
  });

  it("403 — chef cannot fetch tables", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.find.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .get("/api/v1/admin/tables")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/tables/:id
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/tables/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch a single table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findById.mockResolvedValue(mockTableDoc());

    const res = await request(app)
      .get(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.table.tableNumber).toBe(1);
  });

  it("200 — waiter can fetch a single table (needed for order page)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(mockTableDoc());

    const res = await request(app)
      .get(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
  });

  it("404 — returns 404 when table does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(
      `/api/v1/admin/tables/${VALID_TABLE_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — chef cannot fetch a single table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .get(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/tables/:id
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/tables/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can update a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findByIdAndUpdate.mockResolvedValue(
      mockTableDoc({ capacity: 6, status: "occupied" }),
    );

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ capacity: 6, status: "occupied" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Table updated");
    expect(res.body.table.capacity).toBe(6);
    expect(res.body.table.status).toBe("occupied");
  });

  it("200 — manager can update a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Table.findByIdAndUpdate.mockResolvedValue(mockTableDoc({ capacity: 8 }));

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ capacity: 8 });

    expect(res.status).toBe(200);
  });

  it("404 — returns 404 when table does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ capacity: 6 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .send({ capacity: 6 });

    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot update a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ capacity: 6 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — cashier cannot update a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ capacity: 6 });

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot update a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`)
      .send({ capacity: 6 });

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findByIdAndUpdate.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .put(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ capacity: 6 });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/tables/:id
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/admin/tables/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can delete a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findByIdAndDelete.mockResolvedValue(mockTableDoc());

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Table deleted");
  });

  it("404 — returns 404 when table does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).delete(
      `/api/v1/admin/tables/${VALID_TABLE_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — manager cannot delete a table (admin only)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — waiter cannot delete a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot delete a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot delete a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findByIdAndDelete.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .delete(`/api/v1/admin/tables/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(500);
  });
});
