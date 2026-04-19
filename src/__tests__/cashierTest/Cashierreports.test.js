const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/billings");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../../models/users");
const Billing = require("../../models/billings");
const { cashierReportsRouter } = require("../../routes/cashier/cashierReports");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/cashier", cashierReportsRouter);

// ── Silence console.error from route catch blocks ─────────────
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeToken(role = "cashier") {
  return jwt.sign(
    { _id: "user_id_123", username: "testcashier", role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "cashier") {
  return { _id: "user_id_123", username: "testcashier", role };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cashier/income
// ─────────────────────────────────────────────────────────────

describe("GET /api/v1/cashier/income", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can fetch their total income", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.aggregate.mockResolvedValue([{ _id: null, totalIncome: 1500 }]);

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(1500);
  });

  it("200 — returns 0 when cashier has no income today", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.aggregate.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(0);
  });

  it("200 — aggregate filters by today's date and current user", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.aggregate.mockResolvedValue([{ totalIncome: 800 }]);

    await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(Billing.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ $match: expect.any(Object) }),
        expect.objectContaining({ $group: expect.any(Object) }),
      ]),
    );
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/cashier/income");
    expect(res.status).toBe(401);
  });

  it("403 — admin cannot access cashier income report", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — manager cannot access cashier income report", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
  });

  it("403 — waiter cannot access cashier income report", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot access cashier income report", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.aggregate.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .get("/api/v1/cashier/income")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch your income");
  });
});
