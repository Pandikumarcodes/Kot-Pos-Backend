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
const logger = require("../../config/logger");
const { cashierbillingRouter } = require("../../routes/cashier/cashierBilling");

const branchId = new mongoose.Types.ObjectId().toString();
const otherBranchMemberId = new mongoose.Types.ObjectId().toString();
const outsideBranchMemberId = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/cashier", cashierbillingRouter);

const token = () =>
  jwt.sign(
    { _id: new mongoose.Types.ObjectId().toString(), role: "cashier", branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

const setupQuery = ({ result = [], error } = {}) => {
  const query = {
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
  };
  query.populate.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(error ? Promise.reject(error) : Promise.resolve(result));
  Billing.find.mockReturnValue(query);
  return query;
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({
    _id: new mongoose.Types.ObjectId(),
    role: "cashier",
    branchId,
  });
  User.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue([
      { _id: new mongoose.Types.ObjectId().toString(), branchId },
      { _id: otherBranchMemberId, branchId },
    ]),
  });
  Billing.countDocuments.mockResolvedValue(0);
});

describe("cashier bills runtime contract", () => {
  test("assigned cashier lists bills, maps billDate to createdAt, and scopes direct branch ownership", async () => {
    const query = setupQuery({ result: [{ billNumber: "BILL-1" }] });
    Billing.countDocuments.mockResolvedValue(1);

    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20&sort=billDate&order=desc")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      myBills: [{ billNumber: "BILL-1" }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    expect(JSON.stringify(Billing.find.mock.calls[0][0])).toContain(branchId);
    expect(Billing.find.mock.calls[0][0].createdBy).toBeUndefined();
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  });

  test("empty bill list returns 200 with zero pagination", async () => {
    setupQuery({ result: [] });

    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20&sort=billDate&order=desc")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(200);
    expect(response.body.myBills).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
  });

  test("cross-branch bills are excluded by direct branch ownership", async () => {
    setupQuery({ result: [] });

    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20&sort=billDate&order=desc")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(200);
    const [filter] = Billing.find.mock.calls[0];
    expect(JSON.stringify(filter)).toContain(branchId);
    expect(filter.createdBy).toBeUndefined();
  });

  test("missing cashier branch assignment returns controlled 403", async () => {
    User.findById.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      role: "cashier",
      branchId: null,
    });

    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(403);
    expect(Billing.find).not.toHaveBeenCalled();
  });

  test("invalid branchId returns 400", async () => {
    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20&branchId=invalid")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(400);
    expect(Billing.find).not.toHaveBeenCalled();
  });

  test("repository failure returns sanitized 500", async () => {
    setupQuery({ error: new Error("MongoServerError: secret connection details") });

    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to fetch Bills");
    expect(response.body.error).not.toMatch(/mongo|secret|connection/i);
    expect(response.body).not.toHaveProperty("stack");
    expect(logger.error).toHaveBeenCalledWith(
      "BillingService.listBills repository failure",
      expect.objectContaining({
        normalizedBranchId: branchId,
        filter: expect.objectContaining({ branchId }),
        page: 1,
        limit: 20,
        sort: null,
        order: null,
      }),
    );
  });

  test("malformed legacy member IDs do not affect direct branch queries", async () => {
    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "not-an-object-id", branchId },
      ]),
    });
    setupQuery({ result: [] });

    const response = await request(app)
      .get("/api/v1/cashier/bills?page=1&limit=20")
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(200);
    expect(response.body.myBills).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
    expect(JSON.stringify(Billing.find.mock.calls[0][0])).toContain(branchId);
  });
});
