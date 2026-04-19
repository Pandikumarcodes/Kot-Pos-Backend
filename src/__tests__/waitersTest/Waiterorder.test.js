const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock all models ───────────────────────────────────────────
jest.mock("../../models/users");
jest.mock("../../models/waiter");
jest.mock("../../models/menuItems");
jest.mock("../../models/kot");
jest.mock("../../models/tables");
jest.mock("../../models/billings");

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
    billingUpdated: jest.fn(),
    kotUpdated: jest.fn(),
    tableUpdated: jest.fn(),
  },
}));

const User = require("../../models/users");
const TableOrder = require("../../models/waiter");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot");
const Table = require("../../models/tables");
const Billing = require("../../models/billings");
const { waiterOrderRouter } = require("../../routes/waiter/waiterOrderRouter");

// ── Mock socket.io instance ───────────────────────────────────
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// ── Build minimal Express app ─────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("io", mockIo);
app.use("/api/v1/waiter", waiterOrderRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_TABLE_ID = new mongoose.Types.ObjectId().toString();
const VALID_ORDER_ID = new mongoose.Types.ObjectId().toString();
const VALID_ITEM_ID = new mongoose.Types.ObjectId().toString();
const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

function makeToken(role = "waiter", branchId = VALID_BRANCH_ID) {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

// Admin token has no branchId (super-admin)
function makeAdminToken() {
  return jwt.sign(
    { _id: "admin_id_123", username: "admin", role: "admin", branchId: null },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "waiter", branchId = VALID_BRANCH_ID) {
  return { _id: "user_id_123", username: "testuser", role, branchId };
}

function mockMenuItemDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    ItemName: "Paneer Butter Masala",
    price: 280,
    category: "main_course",
    available: true,
    ...overrides,
  };
}

function mockOrderDoc(overrides = {}) {
  return {
    _id: VALID_ORDER_ID,
    tableId: VALID_TABLE_ID,
    tableNumber: 1,
    customerName: "Walk-in",
    status: "pending",
    items: [
      {
        itemId: VALID_ITEM_ID,
        name: "Paneer Butter Masala",
        quantity: 2,
        price: 280,
        toObject: jest.fn().mockReturnValue({
          itemId: VALID_ITEM_ID,
          name: "Paneer Butter Masala",
          quantity: 2,
          price: 280,
        }),
      },
    ],
    totalAmount: 560,
    createdBy: "user_id_123",
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockBillDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    billNumber: "BILL-20250101-001",
    customerName: "Walk-in",
    totalAmount: 560,
    paymentStatus: "unpaid",
    tableId: VALID_TABLE_ID,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Middleware — branchScope blocking unassigned non-admin
// ─────────────────────────────────────────────────────────────
describe("branchScope middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("403 — blocks non-admin user with no branchId", async () => {
    // branchId: null + role: waiter → blocked by branchScope
    const token = jwt.sign(
      {
        _id: "user_id_123",
        username: "testuser",
        role: "waiter",
        branchId: null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    User.findById.mockResolvedValue({
      _id: "user_id_123",
      role: "waiter",
      branchId: null,
    });

    const res = await request(app)
      .get("/api/v1/waiter/menu")
      .set("Cookie", `token=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("not been assigned to a branch");
  });

  it("401 — blocks unauthenticated requests", async () => {
    const res = await request(app).get("/api/v1/waiter/menu");
    expect(res.status).toBe(401);
  });

  it("403 — blocks chef role (not in allowRoles list)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("chef"));
    const res = await request(app)
      .get("/api/v1/waiter/menu")
      .set("Cookie", `token=${makeToken("chef")}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/waiter/menu
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/waiter/menu", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — waiter can fetch available menu items", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    MenuItem.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockMenuItemDoc()]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/waiter/menu")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.menuItems).toHaveLength(1);
    expect(res.body.menuItems[0].ItemName).toBe("Paneer Butter Masala");
  });

  it("200 — filters by category query param", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    MenuItem.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/waiter/menu?category=dessert")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    // Verify find was called with category filter
    expect(MenuItem.find).toHaveBeenCalledWith(
      expect.objectContaining({ category: "dessert", available: true }),
    );
  });

  it("200 — filters by search query param", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    MenuItem.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/waiter/menu?search=paneer")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(MenuItem.find).toHaveBeenCalledWith(
      expect.objectContaining({
        ItemName: { $regex: "paneer", $options: "i" },
      }),
    );
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    MenuItem.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error("DB error")),
      }),
    });

    const res = await request(app)
      .get("/api/v1/waiter/menu")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/waiter/orders/table/:tableId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/waiter/orders/table/:tableId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns all active orders for a table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    const order = mockOrderDoc();
    TableOrder.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([order]),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.grandTotal).toBe(560);
  });

  it("200 — returns empty arrays when table has no active orders", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(0);
    expect(res.body.grandTotal).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/waiter/orders
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/waiter/orders", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    tableId: VALID_TABLE_ID,
    tableNumber: 1,
    customerName: "Walk-in",
    items: [{ itemId: VALID_ITEM_ID, quantity: 2 }],
  };

  it("201 — waiter can create an order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    const menuItem = mockMenuItemDoc({
      _id: new mongoose.Types.ObjectId(VALID_ITEM_ID),
    });
    MenuItem.find.mockResolvedValue([menuItem]);
    const savedOrder = mockOrderDoc();
    TableOrder.mockImplementation(() => savedOrder);

    const res = await request(app)
      .post("/api/v1/waiter/orders")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Order created successfully");
  });

  it("400 — rejects missing tableId", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/waiter/orders")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ items: [{ itemId: VALID_ITEM_ID, quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("tableId and items are required");
  });

  it("400 — rejects empty items array", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/waiter/orders")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ tableId: VALID_TABLE_ID, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("tableId and items are required");
  });

  it("400 — rejects when some menu items not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    MenuItem.find.mockResolvedValue([]); // none found

    const res = await request(app)
      .post("/api/v1/waiter/orders")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Some menu items not found");
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/waiter/orders
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/waiter/orders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns all orders for the branch", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockOrderDoc()]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/waiter/orders")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.myOrders).toHaveLength(1);
  });

  it("200 — returns empty array when no orders exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/waiter/orders")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.myOrders).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/waiter/orders/:orderId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/waiter/orders/:orderId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns a single order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrderDoc()),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/waiter/orders/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.order.totalAmount).toBe(560);
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/waiter/orders/${VALID_ORDER_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/waiter/orders/:orderId/send
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/waiter/orders/:orderId/send", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — sends order to kitchen and creates KOT", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findById.mockResolvedValue(mockOrderDoc({ status: "pending" }));
    TableOrder.findByIdAndUpdate.mockResolvedValue(
      mockOrderDoc({ status: "sent_to_kitchen" }),
    );
    Table.findById.mockResolvedValue({ tableNumber: 1 });
    Kot.create.mockResolvedValue({ _id: "kot_id", orderType: "dine-in" });

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/send`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order sent to kitchen (KOT)");
    expect(Kot.create).toHaveBeenCalled();
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/send`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("409 — rejects if order already sent to kitchen", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findById.mockResolvedValue(
      mockOrderDoc({ status: "sent_to_kitchen" }),
    );

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/send`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Order has already been sent to kitchen");
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/waiter/orders/:orderId/served
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/waiter/orders/:orderId/served", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — marks order as served", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findByIdAndUpdate.mockResolvedValue(
      mockOrderDoc({ status: "served" }),
    );

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/served`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order marked as served");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/served`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/waiter/orders/:orderId/cancel
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/waiter/orders/:orderId/cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — cancels an order", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findByIdAndUpdate.mockResolvedValue(
      mockOrderDoc({ status: "cancelled" }),
    );

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order has been cancelled");
  });

  it("404 — returns 404 when order not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    TableOrder.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/waiter/orders/${VALID_ORDER_ID}/cancel`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/waiter/orders/table/:tableId/send-to-cashier
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/waiter/orders/table/:tableId/send-to-cashier", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    customerName: "Ravi Kumar",
    customerPhone: "9876543210",
    tableNumber: 1,
  };

  it("201 — sends bill to cashier successfully", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Billing.findOne.mockResolvedValue(null); // no existing unpaid bill
    TableOrder.find.mockResolvedValue([mockOrderDoc()]);
    Billing.countDocuments.mockResolvedValue(0);
    Billing.create.mockResolvedValue(mockBillDoc());
    TableOrder.updateMany.mockResolvedValue({});
    Table.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}/send-to-cashier`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Bill sent to cashier");
    expect(Billing.create).toHaveBeenCalled();
  });

  it("400 — rejects when unpaid bill already exists", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Billing.findOne.mockResolvedValue(mockBillDoc()); // existing unpaid bill

    const res = await request(app)
      .post(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}/send-to-cashier`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("unpaid bill already exists");
  });

  it("400 — rejects when no active orders for the table", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Billing.findOne.mockResolvedValue(null);
    TableOrder.find.mockResolvedValue([]); // no active orders

    const res = await request(app)
      .post(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}/send-to-cashier`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No active orders found for this table");
  });

  it("201 — uses placeholder phone when invalid phone provided", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Billing.findOne.mockResolvedValue(null);
    TableOrder.find.mockResolvedValue([mockOrderDoc()]);
    Billing.countDocuments.mockResolvedValue(2);
    Billing.create.mockResolvedValue(mockBillDoc());
    TableOrder.updateMany.mockResolvedValue({});
    Table.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}/send-to-cashier`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ ...validPayload, customerPhone: "invalid" });

    expect(res.status).toBe(201);
    // Billing.create should have been called with "0000000000"
    expect(Billing.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: "0000000000" }),
    );
  });

  it("201 — uses Walk-in when no customerName provided", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));
    Billing.findOne.mockResolvedValue(null);
    TableOrder.find.mockResolvedValue([mockOrderDoc()]);
    Billing.countDocuments.mockResolvedValue(0);
    Billing.create.mockResolvedValue(mockBillDoc());
    TableOrder.updateMany.mockResolvedValue({});
    Table.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/v1/waiter/orders/table/${VALID_TABLE_ID}/send-to-cashier`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ tableNumber: 1 });

    expect(res.status).toBe(201);
    expect(Billing.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: "Walk-in" }),
    );
  });
});
