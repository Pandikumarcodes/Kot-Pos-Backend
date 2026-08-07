const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/billings");
jest.mock("../../models/tables");
jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({
    execute: jest.fn((work) => work({ id: "payment-contract-session" })),
  })),
);
jest.mock("../../services/notificationservices", () => ({
  notify: { billingUpdated: jest.fn() },
}));
jest.mock("../../modules/billing/BillingAuditLogger", () => ({
  createContext: jest.fn((values = {}) => ({
    actor: values.actorId || "billing-service",
    actorRole: values.actorRole || null,
    branchId: values.branchId || null,
    correlationId: values.correlationId || "test-correlation",
  })),
  paymentCollected: jest.fn().mockResolvedValue(undefined),
  failure: jest.fn().mockResolvedValue(undefined),
}));

const User = require("../../models/users");
const Billing = require("../../models/billings");
const { cashierbillingRouter } = require("../../routes/cashier/cashierBilling");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("io", { to: jest.fn().mockReturnThis(), emit: jest.fn() });
app.use("/api/v1/cashier", cashierbillingRouter);

const billId = new mongoose.Types.ObjectId().toString();
const branchId = new mongoose.Types.ObjectId().toString();
const cashierId = new mongoose.Types.ObjectId().toString();

const makeToken = (role = "cashier") =>
  jwt.sign(
    { _id: cashierId, username: "cashier", role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

const makeBill = (overrides = {}) => ({
  _id: billId,
  paymentStatus: "unpaid",
  paymentMethod: "none",
  totalAmount: 100,
  tableId: null,
  createdBy: cashierId,
  branchId,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const pay = (body, id = billId, role = "cashier") =>
  request(app)
    .put(`/api/v1/cashier/bills/${id}/pay`)
    .set("Cookie", `token=${makeToken(role)}`)
    .send(body);

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({
    _id: cashierId,
    username: "cashier",
    role: "cashier",
    branchId,
  });
  User.find.mockReturnValue({
    distinct: jest.fn().mockResolvedValue([cashierId]),
  });
});

describe("cashier bill payment contract", () => {
  test("uses PUT and returns the documented success envelope", async () => {
    const bill = makeBill();
    Billing.findOne.mockResolvedValue(bill);

    const res = await pay({ paymentMethod: "upi" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Bill marked as paid successfully",
        bill: expect.objectContaining({ paymentStatus: "paid" }),
      }),
    );
    expect(bill.paymentMethod).toBe("upi");
    expect(bill.save).toHaveBeenCalledTimes(1);
  });

  test.each([undefined, {}, { paymentMethod: null }])(
    "rejects a missing payment method with 400 (%p)",
    async (body) => {
      const res = await pay(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/payment ?method/i);
      expect(Billing.findOne).not.toHaveBeenCalled();
    },
  );

  test("rejects unsupported payment methods with 400", async () => {
    const res = await pay({ paymentMethod: "wallet" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paymentMethod.*cash.*card.*upi/i);
  });

  test("rejects an invalid bill id with 400", async () => {
    const res = await pay({ paymentMethod: "cash" }, "not-an-object-id");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid Bill Id");
    expect(Billing.findOne).not.toHaveBeenCalled();
  });

  test("returns 404 for a missing or cross-branch bill", async () => {
    Billing.findOne.mockResolvedValue(null);

    const res = await pay({ paymentMethod: "cash" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Bill not found");
    expect(JSON.stringify(Billing.findOne.mock.calls[0][0])).toContain(branchId);
    expect(Billing.findOne.mock.calls[0][0].createdBy).toBeUndefined();
  });

  test("does not pay a bill created by a different branch member", async () => {
    User.find.mockReturnValue({
      distinct: jest.fn().mockResolvedValue([new mongoose.Types.ObjectId()]),
    });
    Billing.findOne.mockResolvedValue(null);

    const res = await pay({ paymentMethod: "cash" });

    expect(res.status).toBe(404);
    expect(JSON.stringify(Billing.findOne.mock.calls[0][0])).toContain(branchId);
    expect(Billing.findOne.mock.calls[0][0].createdBy).toBeUndefined();
  });

  test("returns 409 for an already-paid bill", async () => {
    Billing.findOne.mockResolvedValue(makeBill({ paymentStatus: "paid" }));

    const res = await pay({ paymentMethod: "cash" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Bill is already paid");
  });

  test("maps unexpected repository failures to a controlled 500", async () => {
    Billing.findOne.mockRejectedValue(
      new Error("MongoServerError: credentials and stack details"),
    );

    const res = await pay({ paymentMethod: "cash" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to update bill payment status");
    expect(res.body.error).not.toMatch(/mongo|credentials|stack/i);
    expect(res.body).not.toHaveProperty("stack");
  });

  test("a duplicate request does not save or pay twice", async () => {
    const bill = makeBill();
    Billing.findOne.mockResolvedValue(bill);

    const first = await pay({ paymentMethod: "cash" });
    const second = await pay({ paymentMethod: "cash" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(bill.save).toHaveBeenCalledTimes(1);
  });
});
