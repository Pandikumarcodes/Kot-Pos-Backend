const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/users");
jest.mock("../../models/kot");

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock notification service ─────────────────────────────────
jest.mock("../../services/notificationservices", () => ({
  notify: {
    kotUpdated: jest.fn(),
  },
}));

const User = require("../../models/users");
const Kot = require("../../models/kot");
const { notify } = require("../../services/notificationservices");
const { chefRouter } = require("../../routes/chef/chefRouter");

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
app.use("/api/v1/chef", chefRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_ORDER_ID = new mongoose.Types.ObjectId().toString();

function makeToken(role = "chef") {
  return jwt.sign(
    { _id: "user_id_123", username: "testchef", role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "chef") {
  return { _id: "user_id_123", username: "testchef", role };
}

function mockKotDoc(overrides = {}) {
  return {
    _id: VALID_ORDER_ID,
    orderType: "dine-in",
    tableNumber: 1,
    customerName: "Walk-in",
    status: "pending",
    items: [{ name: "Paneer Butter Masala", quantity: 2, price: 280 }],
    totalAmount: 560,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/chef/kot
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/chef/kot", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — chef can fetch all active KOT orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.find.mockReturnValue({
      sort: jest
        .fn()
        .mockResolvedValue([
          mockKotDoc({ status: "pending" }),
          mockKotDoc({ status: "preparing" }),
        ]),
    });

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.KotOrders).toHaveLength(2);
  });

  it("200 — admin can fetch all active KOT orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Kot.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockKotDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
  });

  it("200 — manager can fetch all active KOT orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Kot.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockKotDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("200 — returns empty array when no active orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.KotOrders).toHaveLength(0);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/chef/kot");
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot access KOT", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — cashier cannot access KOT", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });

  it("400 — returns 400 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("DB error")),
    });

    const res = await request(app)
      .get("/api/v1/chef/kot")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/chef/kot/:orderId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/chef/kot/:orderId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — chef can fetch a single KOT order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findById.mockResolvedValue(mockKotDoc());

    const res = await request(app)
      .get(`/api/v1/chef/kot/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.order.totalAmount).toBe(560);
    expect(res.body.order.status).toBe("pending");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/chef/kot/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(`/api/v1/chef/kot/${VALID_ORDER_ID}`);
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot fetch a single KOT order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get(`/api/v1/chef/kot/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/chef/kot/:orderId/start
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/chef/kot/:orderId/start", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — chef can mark order as preparing", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findByIdAndUpdate.mockResolvedValue(
      mockKotDoc({ status: "preparing" }),
    );

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/start`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order marked as preparing");
    expect(res.body.order.status).toBe("preparing");
  });

  it("200 — calls notify.kotUpdated after marking preparing", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    const order = mockKotDoc({ status: "preparing" });
    Kot.findByIdAndUpdate.mockResolvedValue(order);

    await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/start`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(notify.kotUpdated).toHaveBeenCalledWith(mockIo, order);
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/start`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(
      `/api/v1/chef/kot/${VALID_ORDER_ID}/start`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot start cooking", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/start`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot start cooking", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/start`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/chef/kot/:orderId/ready
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/chef/kot/:orderId/ready", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — chef can mark order as ready", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findByIdAndUpdate.mockResolvedValue(mockKotDoc({ status: "ready" }));

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/ready`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order marked as ready");
    expect(res.body.order.status).toBe("ready");
  });

  it("200 — calls notify.kotUpdated after marking ready", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    const order = mockKotDoc({ status: "ready" });
    Kot.findByIdAndUpdate.mockResolvedValue(order);

    await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/ready`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(notify.kotUpdated).toHaveBeenCalledWith(mockIo, order);
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/ready`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(
      `/api/v1/chef/kot/${VALID_ORDER_ID}/ready`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot mark order ready", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/ready`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/chef/kot/:orderId/cancel
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/chef/kot/:orderId/cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — chef can cancel an order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findByIdAndUpdate.mockResolvedValue(
      mockKotDoc({ status: "cancelled" }),
    );

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order cancelled");
    expect(res.body.order.status).toBe("cancelled");
  });

  it("200 — calls notify.kotUpdated after cancelling", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    const order = mockKotDoc({ status: "cancelled" });
    Kot.findByIdAndUpdate.mockResolvedValue(order);

    await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(notify.kotUpdated).toHaveBeenCalledWith(mockIo, order);
  });

  it("200 — admin can cancel an order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Kot.findByIdAndUpdate.mockResolvedValue(
      mockKotDoc({ status: "cancelled" }),
    );

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    Kot.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).put(
      `/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot cancel a KOT order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot cancel a KOT order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .put(`/api/v1/chef/kot/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });
});
