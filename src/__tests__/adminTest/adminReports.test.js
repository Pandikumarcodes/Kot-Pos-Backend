const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/billings");
jest.mock("../../models/kot");
jest.mock("../../models/waiter");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../../models/users");
const Billing = require("../../models/billings");
const Kot = require("../../models/kot");
const TableOrder = require("../../models/waiter");
const { adminReportRouter } = require("../../routes/admin/adminReportRouter");

const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminReportRouter);

function makeToken(role = "admin") {
  return jwt.sign(
    {
      _id: "user_id_123",
      username: "testuser",
      role,
      branchId: VALID_BRANCH_ID,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "admin") {
  return { _id: "user_id_123", username: "testuser", role };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/reports/summary
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/reports/summary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch summary stats", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([{ total: 5000, count: 10 }]);
    TableOrder.countDocuments.mockResolvedValue(8);
    Kot.countDocuments.mockResolvedValue(3);

    const res = await request(app)
      .get("/api/v1/admin/reports/summary")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(5000);
    expect(res.body.totalBills).toBe(10);
    expect(res.body.dineInCount).toBe(8);
    expect(res.body.takeawayCount).toBe(3);
  });

  it("200 — manager can fetch summary stats", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Billing.aggregate.mockResolvedValue([]);
    TableOrder.countDocuments.mockResolvedValue(0);
    Kot.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get("/api/v1/admin/reports/summary")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(0);
  });

  it("200 — returns zero values when no data", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([]);
    TableOrder.countDocuments.mockResolvedValue(0);
    Kot.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get("/api/v1/admin/reports/summary")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(0);
    expect(res.body.avgOrderValue).toBe(0);
  });

  it("200 — accepts range=week query param", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([{ total: 15000, count: 30 }]);
    TableOrder.countDocuments.mockResolvedValue(20);
    Kot.countDocuments.mockResolvedValue(10);

    const res = await request(app)
      .get("/api/v1/admin/reports/summary?range=week")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(15000);
  });

  it("200 — accepts range=custom with from and to params", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([{ total: 8000, count: 15 }]);
    TableOrder.countDocuments.mockResolvedValue(10);
    Kot.countDocuments.mockResolvedValue(5);

    const res = await request(app)
      .get(
        "/api/v1/admin/reports/summary?range=custom&from=2025-01-01&to=2025-01-31",
      )
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/reports/summary");
    expect(res.status).toBe(401);
  });

  it("403 — cashier cannot view reports", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .get("/api/v1/admin/reports/summary")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });

  it("403 — waiter cannot view reports", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get("/api/v1/admin/reports/summary")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/reports/top-items
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/reports/top-items", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns top selling items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Kot.aggregate.mockResolvedValue([
      { name: "Paneer Butter Masala", quantity: 25, revenue: 7000 },
      { name: "Mango Lassi", quantity: 18, revenue: 1440 },
    ]);

    const res = await request(app)
      .get("/api/v1/admin/reports/top-items")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.topItems).toHaveLength(2);
  });

  it("200 — returns empty array when no orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Kot.aggregate.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/v1/admin/reports/top-items")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.topItems).toHaveLength(0);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/reports/top-items");
    expect(res.status).toBe(401);
  });

  it("403 — chef cannot view top items report", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .get("/api/v1/admin/reports/top-items")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/reports/payments
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/reports/payments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns payment method breakdown", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([
      { method: "cash", count: 10, amount: 5000 },
      { method: "upi", count: 5, amount: 2500 },
    ]);

    const res = await request(app)
      .get("/api/v1/admin/reports/payments")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(2);
    // Verify percentage is calculated
    expect(res.body.payments[0].percentage).toBeDefined();
  });

  it("200 — returns zero percentage when no payments", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/v1/admin/reports/payments")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(0);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/reports/payments");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/reports/hourly
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/reports/hourly", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns hourly sales data", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([
      { hour: 12, orders: 5, revenue: 2500 },
      { hour: 13, orders: 8, revenue: 4000 },
    ]);

    const res = await request(app)
      .get("/api/v1/admin/reports/hourly")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.hourly).toHaveLength(2);
    // Verify hour label formatting
    expect(res.body.hourly[0].hour).toBe("12 PM");
    expect(res.body.hourly[1].hour).toBe("1 PM");
  });

  it("200 — formats AM hours correctly", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.aggregate.mockResolvedValue([
      { hour: 9, orders: 3, revenue: 1200 },
    ]);

    const res = await request(app)
      .get("/api/v1/admin/reports/hourly")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.hourly[0].hour).toBe("9 AM");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/reports/hourly");
    expect(res.status).toBe(401);
  });
});
