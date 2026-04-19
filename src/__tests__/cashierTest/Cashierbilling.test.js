const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/users");
jest.mock("../../models/billings");
jest.mock("../../models/menuItems");
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
    billingUpdated: jest.fn(),
  },
}));

const User = require("../../models/users");
const Billing = require("../../models/billings");
const MenuItem = require("../../models/menuItems");
const Table = require("../../models/tables");
const { notify } = require("../../services/notificationservices");
const { cashierbillingRouter } = require("../../routes/cashier/cashierBilling");

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
app.use("/api/v1/cashier", cashierbillingRouter);

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

const VALID_BILL_ID = new mongoose.Types.ObjectId().toString();
const VALID_ITEM_ID = new mongoose.Types.ObjectId().toString();
const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

function makeToken(role = "cashier", branchId = VALID_BRANCH_ID) {
  return jwt.sign(
    { _id: "user_id_123", username: "testcashier", role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "cashier", branchId = VALID_BRANCH_ID) {
  return { _id: "user_id_123", username: "testcashier", role, branchId };
}

function mockMenuItemDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(VALID_ITEM_ID),
    ItemName: "Paneer Butter Masala",
    price: 280,
    ...overrides,
  };
}

function mockBillDoc(overrides = {}) {
  return {
    _id: VALID_BILL_ID,
    billNumber: "BILL-20250101-001",
    customerName: "Ravi Kumar",
    customerPhone: "9876543210",
    items: [
      {
        itemId: VALID_ITEM_ID,
        name: "Paneer Butter Masala",
        quantity: 2,
        price: 280,
        total: 560,
      },
    ],
    totalAmount: 560,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    tableId: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/cashier/billing
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/cashier/billing", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    customerName: "Ravi Kumar",
    customerPhone: "9876543210",
    items: [{ itemId: VALID_ITEM_ID, quantity: 2 }],
    paymentStatus: "paid",
    paymentMethod: "cash",
  };

  it("201 — cashier can create a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.countDocuments.mockResolvedValue(0);
    MenuItem.findById.mockResolvedValue(mockMenuItemDoc());
    const savedBill = mockBillDoc();
    Billing.mockImplementation(() => savedBill);

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Bill generated successfully");
    expect(notify.billingUpdated).toHaveBeenCalled();
  });

  it("201 — admin can create a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Billing.countDocuments.mockResolvedValue(2);
    MenuItem.findById.mockResolvedValue(mockMenuItemDoc());
    Billing.mockImplementation(() => mockBillDoc());

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validPayload);

    expect(res.status).toBe(201);
  });

  it("400 — rejects when items array is empty", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ ...validPayload, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Items are required");
  });

  it("400 — rejects when items is missing", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ customerName: "Ravi" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Items are required");
  });

  it("400 — rejects item missing itemId", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ ...validPayload, items: [{ quantity: 2 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("itemId is required for each item");
  });

  it("404 — rejects when menu item not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.countDocuments.mockResolvedValue(0);
    MenuItem.findById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send(validPayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Menu item not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot create a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — chef cannot create a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .post("/api/v1/cashier/billing")
      .set("Cookie", `token=${makeToken("chef")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cashier/bills
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/cashier/bills", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can fetch all bills", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockBillDoc()]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/cashier/bills")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.myBills).toHaveLength(1);
  });

  it("200 — filters by status query param", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue([mockBillDoc({ paymentStatus: "paid" })]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/cashier/bills?status=paid")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: "paid" }),
    );
  });

  it("200 — filters by search query param", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockBillDoc()]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/cashier/bills?search=Ravi")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ $or: expect.any(Array) }),
    );
  });

  it("404 — returns 404 when no bills found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/cashier/bills")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No Bills found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/cashier/bills");
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot fetch bills", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get("/api/v1/cashier/bills")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error("DB error")),
      }),
    });

    const res = await request(app)
      .get("/api/v1/cashier/bills")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch Bills");
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cashier/bills/:billId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/cashier/bills/:billId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can fetch a single bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockBillDoc()),
    });

    const res = await request(app)
      .get(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.bill.billNumber).toBe("BILL-20250101-001");
  });

  it("404 — returns 404 when bill not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .get(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Bill not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(
      `/api/v1/cashier/bills/${VALID_BILL_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — chef cannot fetch a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .get(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/cashier/bills/:billId/pay
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/cashier/bills/:billId/pay", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can mark a bill as paid", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockResolvedValue(mockBillDoc());

    const res = await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ paymentMethod: "upi" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Bill marked as paid successfully");
    expect(notify.billingUpdated).toHaveBeenCalled();
  });

  it("200 — frees the table when bill has a tableId", async () => {
    const TABLE_ID = new mongoose.Types.ObjectId().toString();
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockResolvedValue(mockBillDoc({ tableId: TABLE_ID }));
    Table.findByIdAndUpdate.mockResolvedValue({});

    await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ paymentMethod: "cash" });

    expect(Table.findByIdAndUpdate).toHaveBeenCalledWith(TABLE_ID, {
      status: "available",
      currentCustomer: null,
    });
  });

  it("200 — does not update table when bill has no tableId", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockResolvedValue(mockBillDoc({ tableId: null }));

    await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ paymentMethod: "cash" });

    expect(Table.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("200 — updates paymentMethod when provided", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    const bill = mockBillDoc({ paymentMethod: "cash" });
    Billing.findById.mockResolvedValue(bill);

    await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ paymentMethod: "upi" });

    expect(bill.paymentMethod).toBe("upi");
    expect(bill.save).toHaveBeenCalled();
  });

  it("400 — rejects when bill is already paid", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockResolvedValue(mockBillDoc({ paymentStatus: "paid" }));

    const res = await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ paymentMethod: "cash" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Bill is already paid");
  });

  it("404 — returns 404 when bill not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ paymentMethod: "cash" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Bill not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .send({ paymentMethod: "cash" });
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot mark bill as paid", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put(`/api/v1/cashier/bills/${VALID_BILL_ID}/pay`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ paymentMethod: "cash" });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/cashier/bills/:billId
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/cashier/bills/:billId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can delete a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findByIdAndDelete.mockResolvedValue(mockBillDoc());

    const res = await request(app)
      .delete(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Bill deleted successfully");
    expect(res.body.bill.billNumber).toBe("BILL-20250101-001");
  });

  it("400 — rejects invalid bill ID format", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .delete("/api/v1/cashier/bills/invalid_id")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid Bill Id");
  });

  it("404 — returns 404 when bill not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Billing.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Bill not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).delete(
      `/api/v1/cashier/bills/${VALID_BILL_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot delete a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .delete(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot delete a bill", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .delete(`/api/v1/cashier/bills/${VALID_BILL_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });
});
