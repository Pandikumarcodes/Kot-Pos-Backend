const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/users");
jest.mock("../../models/takeAway");
jest.mock("../../models/menuItems");
jest.mock("../../models/kot");

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock inventory controller ─────────────────────────────────
jest.mock("../../controllers/inventoryController", () => ({
  deductStockForKot: jest.fn().mockResolvedValue(true),
}));

// ── Mock notification service ─────────────────────────────────
jest.mock("../../services/notificationservices", () => ({
  notify: {
    newOrder: jest.fn(),
  },
}));

const User = require("../../models/users");
const TakeAway = require("../../models/takeAway");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot");
const { cashierKotRouter } = require("../../routes/cashier/cashierKotOrder");

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
app.use("/api/v1/cashier", cashierKotRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_ORDER_ID = new mongoose.Types.ObjectId().toString();
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
    ItemName: "Mango Lassi",
    price: 80,
    ...overrides,
  };
}

function mockOrderDoc(overrides = {}) {
  return {
    _id: VALID_ORDER_ID,
    customerName: "Ravi Kumar",
    customerPhone: "9876543210",
    status: "pending",
    items: [
      { itemId: VALID_ITEM_ID, name: "Mango Lassi", quantity: 2, price: 80 },
    ],
    totalAmount: 160,
    createdBy: "user_id_123",
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/cashier/takeaway-orders
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/cashier/takeaway-orders", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    customerName: "Ravi Kumar",
    customerPhone: "9876543210",
    items: [{ itemId: VALID_ITEM_ID, quantity: 2 }],
  };

  it("201 — cashier can create a takeaway order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    MenuItem.find.mockResolvedValue([mockMenuItemDoc()]);
    const savedOrder = mockOrderDoc();
    TakeAway.mockImplementation(() => savedOrder);

    const res = await request(app)
      .post("/api/v1/cashier/takeaway-orders")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Order created successfully");
  });

  it("400 — rejects when some menu items not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    MenuItem.find.mockResolvedValue([]); // none found

    const res = await request(app)
      .post("/api/v1/cashier/takeaway-orders")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Some menu items not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/cashier/takeaway-orders")
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot create takeaway order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/cashier/takeaway-orders")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot create takeaway order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));

    const res = await request(app)
      .post("/api/v1/cashier/takeaway-orders")
      .set("Cookie", `token=${makeToken("chef")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cashier/takeaway-orders
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/cashier/takeaway-orders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can fetch all takeaway orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockOrderDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/cashier/takeaway-orders")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.myOrders).toHaveLength(1);
  });

  it("200 — returns empty array when no orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/v1/cashier/takeaway-orders")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.myOrders).toHaveLength(0);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/cashier/takeaway-orders");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cashier/takeaway/:orderId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/cashier/takeaway/:orderId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns a single takeaway order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrderDoc()),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.order.customerName).toBe("Ravi Kumar");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("This order Id not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(
      `/api/v1/cashier/takeaway/${VALID_ORDER_ID}`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/cashier/takeaway/:orderId/send
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/cashier/takeaway/:orderId/send", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can send takeaway order to kitchen", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findById.mockResolvedValue(mockOrderDoc({ status: "pending" }));
    TakeAway.findByIdAndUpdate.mockResolvedValue(
      mockOrderDoc({ status: "sent_to_kitchen" }),
    );
    Kot.create.mockResolvedValue({ _id: "kot_id", orderType: "takeaway" });

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/send`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order sent to kitchen (KOT)");
    expect(Kot.create).toHaveBeenCalled();
  });

  it("409 — rejects if order already sent to kitchen", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findById.mockResolvedValue(
      mockOrderDoc({ status: "sent_to_kitchen" }),
    );

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/send`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Order has already been sent to kitchen");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/send`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(
      `/api/v1/cashier/takeaway/${VALID_ORDER_ID}/send`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/cashier/takeaway/:orderId/received
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/cashier/takeaway/:orderId/received", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — marks order as received", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findByIdAndUpdate.mockResolvedValue(
      mockOrderDoc({ status: "received" }),
    );

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/received`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order received successfully");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/received`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(
      `/api/v1/cashier/takeaway/${VALID_ORDER_ID}/received`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/cashier/takeaway/:orderId/cancel
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/cashier/takeaway/:orderId/cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cashier can cancel a takeaway order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findByIdAndUpdate.mockResolvedValue(
      mockOrderDoc({ status: "cancelled" }),
    );

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order has been cancelled");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    TakeAway.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/cashier/takeaway/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(
      `/api/v1/cashier/takeaway/${VALID_ORDER_ID}/cancel`,
    );
    expect(res.status).toBe(401);
  });
});
