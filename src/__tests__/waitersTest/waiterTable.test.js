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

// ── Mock notification service ─────────────────────────────────
jest.mock("../../services/notificationservices", () => ({
  notify: {
    tableUpdated: jest.fn(),
  },
}));

const User = require("../../models/users");
const Table = require("../../models/tables");
const { notify } = require("../../services/notificationservices");
const { waiterTableRouter } = require("../../routes/waiter/waiterTableRouter");

// ── Mock socket.io ────────────────────────────────────────────
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// ── Build minimal Express app ─────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("io", mockIo);
app.use("/api/v1/waiter", waiterTableRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_TABLE_ID = new mongoose.Types.ObjectId().toString();

function makeToken(role = "waiter") {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "waiter") {
  return { _id: "user_id_123", username: "testuser", role };
}

function mockTableDoc(overrides = {}) {
  return {
    _id: VALID_TABLE_ID,
    tableNumber: 1,
    capacity: 4,
    status: "available",
    currentCustomer: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/waiter/allocate/:tableId
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/waiter/allocate/:tableId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — waiter can allocate an available table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(mockTableDoc());

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ name: "Ravi Kumar", phone: "9876543210" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Table allocated successfully");
  });

  it("200 — manager can allocate a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Table.findById.mockResolvedValue(mockTableDoc());

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ name: "Priya", phone: "9876543210" });

    expect(res.status).toBe(200);
  });

  it("200 — admin can allocate a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Table.findById.mockResolvedValue(mockTableDoc());

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ name: "Arjun", phone: "9876543210" });

    expect(res.status).toBe(200);
  });

  it("200 — sets table status to occupied and saves customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    const table = mockTableDoc();
    Table.findById.mockResolvedValue(table);

    await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(table.status).toBe("occupied");
    expect(table.currentCustomer).toEqual({
      name: "Ravi",
      phone: "9876543210",
    });
    expect(table.save).toHaveBeenCalled();
  });

  it("200 — calls notify.tableUpdated with io and table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    const table = mockTableDoc();
    Table.findById.mockResolvedValue(table);

    await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(notify.tableUpdated).toHaveBeenCalledWith(mockIo, table);
  });

  it("400 — rejects allocation of an already occupied table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(mockTableDoc({ status: "occupied" }));

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Table is already occupied");
  });

  it("404 — returns 404 when table does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(res.status).toBe(401);
  });

  it("403 — cashier cannot allocate a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — chef cannot allocate a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws on save", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(
      mockTableDoc({
        save: jest.fn().mockRejectedValue(new Error("DB error")),
      }),
    );

    const res = await request(app)
      .post(`/api/v1/waiter/allocate/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ name: "Ravi", phone: "9876543210" });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/waiter/free/:tableId
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/waiter/free/:tableId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — waiter can free an occupied table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(mockTableDoc({ status: "occupied" }));

    const res = await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Table is now available");
  });

  it("200 — manager can free a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Table.findById.mockResolvedValue(mockTableDoc({ status: "occupied" }));

    const res = await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("200 — sets table status to available and clears customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    const table = mockTableDoc({
      status: "occupied",
      currentCustomer: { name: "Ravi", phone: "9876543210" },
    });
    Table.findById.mockResolvedValue(table);

    await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(table.status).toBe("available");
    expect(table.currentCustomer).toBeNull();
    expect(table.save).toHaveBeenCalled();
  });

  it("200 — calls notify.tableUpdated after freeing", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    const table = mockTableDoc({ status: "occupied" });
    Table.findById.mockResolvedValue(table);

    await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(notify.tableUpdated).toHaveBeenCalledWith(mockIo, table);
  });

  it("404 — returns 404 when table does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(`/api/v1/waiter/free/${VALID_TABLE_ID}`);
    expect(res.status).toBe(401);
  });

  it("403 — cashier cannot free a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — chef cannot free a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws on save", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Table.findById.mockResolvedValue(
      mockTableDoc({
        status: "occupied",
        save: jest.fn().mockRejectedValue(new Error("DB error")),
      }),
    );

    const res = await request(app)
      .put(`/api/v1/waiter/free/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(500);
  });
});
