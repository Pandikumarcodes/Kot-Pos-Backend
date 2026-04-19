const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/tables");
jest.mock("../../models/menuItems");
jest.mock("../../models/kot");
jest.mock("../../models/settings");

jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const Table = require("../../models/tables");
const MenuItem = require("../../models/menuItems");
const Kot = require("../../models/kot");
const Settings = require("../../models/settings");

const qrMenuRouter = require("../../routes/public/QrMenuRouter");

const app = express();
app.use(express.json());
app.use("/api/v1/public", qrMenuRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_TABLE_ID = new mongoose.Types.ObjectId().toString();
const VALID_ITEM_ID_1 = new mongoose.Types.ObjectId().toString();
const VALID_ITEM_ID_2 = new mongoose.Types.ObjectId().toString();
const VALID_ORDER_ID = new mongoose.Types.ObjectId().toString();
const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

function mockTableDoc(overrides = {}) {
  return {
    _id: VALID_TABLE_ID,
    tableNumber: 5,
    capacity: 4,
    status: "available",
    branchId: VALID_BRANCH_ID,
    ...overrides,
  };
}

function mockMenuItemDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
    ItemName: "Paneer Butter Masala",
    price: 280,
    category: "main_course",
    available: true,
    ...overrides,
  };
}

function mockSettingsDoc(overrides = {}) {
  return {
    businessName: "KOT POS Restaurant",
    address: "123 MG Road",
    phone: "9876543210",
    ...overrides,
  };
}

function mockKotDoc(overrides = {}) {
  return {
    _id: VALID_ORDER_ID,
    status: "pending",
    totalAmount: 560,
    items: [{ name: "Paneer Butter Masala", quantity: 2, price: 280 }],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/menu/:tableId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/public/menu/:tableId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns table info, menu grouped by category, and restaurant info", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockMenuItemDoc()]),
    });
    Settings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockSettingsDoc()),
    });

    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.table.tableNumber).toBe(5);
    expect(res.body.restaurant.name).toBe("KOT POS Restaurant");
    expect(res.body.categories).toContain("main_course");
    expect(res.body.menu.main_course).toHaveLength(1);
  });

  it("200 — groups multiple items by category correctly", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({ category: "main_course" }),
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_2),
          ItemName: "Mango Lassi",
          price: 80,
          category: "beverage",
        }),
      ]),
    });
    Settings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockSettingsDoc()),
    });

    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2);
    expect(res.body.menu.beverage).toHaveLength(1);
    expect(res.body.menu.main_course).toHaveLength(1);
  });

  it("200 — uses default restaurant info when settings not found", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    // Both findOne calls return null
    Settings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.restaurant.name).toBe("KOT POS Restaurant");
    expect(res.body.restaurant.address).toBe("");
    expect(res.body.restaurant.phone).toBe("");
  });

  it("200 — returns empty menu when no available items", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Settings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockSettingsDoc()),
    });

    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(0);
    expect(res.body.menu).toEqual({});
  });

  it("404 — returns 404 when table not found", async () => {
    Table.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("200 — no auth required (public route)", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Settings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockSettingsDoc()),
    });

    // No token set — should still work
    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(200);
  });

  it("500 — returns 500 when DB throws", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error("DB error")),
    });

    const res = await request(app).get(`/api/v1/public/menu/${VALID_TABLE_ID}`);

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/public/order/:tableId
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/public/order/:tableId", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    customerName: "Ravi Kumar",
    customerPhone: "9876543210",
    items: [{ itemId: VALID_ITEM_ID_1, quantity: 2 }],
  };

  it("201 — customer can place an order via QR", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
        }),
      ]),
    });
    Kot.create.mockResolvedValue(mockKotDoc());
    Table.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Order placed! Kitchen has been notified.");
    expect(res.body.orderId).toBeDefined();
    expect(res.body.totalAmount).toBe(560);
  });

  it("201 — uses Guest when no customerName provided", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
        }),
      ]),
    });
    Kot.create.mockResolvedValue(mockKotDoc());
    Table.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send({ items: [{ itemId: VALID_ITEM_ID_1, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(Kot.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: "Guest" }),
    );
  });

  it("201 — marks table as occupied when it was available", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc({ status: "available" })),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
        }),
      ]),
    });
    Kot.create.mockResolvedValue(mockKotDoc());
    Table.findByIdAndUpdate.mockResolvedValue({});

    await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(Table.findByIdAndUpdate).toHaveBeenCalledWith(VALID_TABLE_ID, {
      status: "occupied",
    });
  });

  it("201 — does not update table when already occupied", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc({ status: "occupied" })),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
        }),
      ]),
    });
    Kot.create.mockResolvedValue(mockKotDoc());

    await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(Table.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("201 — KOT is created with createdBy null for self-orders", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
        }),
      ]),
    });
    Kot.create.mockResolvedValue(mockKotDoc());
    Table.findByIdAndUpdate.mockResolvedValue({});

    await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(Kot.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: null }),
    );
  });

  it("400 — rejects empty items array", async () => {
    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send({ customerName: "Ravi", items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No items in order");
  });

  it("400 — rejects missing items field", async () => {
    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send({ customerName: "Ravi" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No items in order");
  });

  it("404 — returns 404 when table not found", async () => {
    Table.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });

  it("400 — rejects when some items are unavailable", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }); // none found

    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Some items are unavailable");
  });

  it("200 — no auth required (public route)", async () => {
    Table.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockTableDoc()),
    });
    MenuItem.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        mockMenuItemDoc({
          _id: new mongoose.Types.ObjectId(VALID_ITEM_ID_1),
        }),
      ]),
    });
    Kot.create.mockResolvedValue(mockKotDoc());
    Table.findByIdAndUpdate.mockResolvedValue({});

    // No Authorization header — should still work
    const res = await request(app)
      .post(`/api/v1/public/order/${VALID_TABLE_ID}`)
      .send(validPayload);

    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/order/:orderId/status
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/public/order/:orderId/status", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns order status for pending order", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockKotDoc({ status: "pending" })),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(res.body.message).toContain("received");
    expect(res.body.total).toBe(560);
  });

  it("200 — returns correct message for preparing status", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockKotDoc({ status: "preparing" })),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("preparing");
    expect(res.body.message).toContain("preparing");
  });

  it("200 — returns correct message for ready status", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockKotDoc({ status: "ready" })),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.message).toContain("ready");
  });

  it("200 — returns correct message for served status", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockKotDoc({ status: "served" })),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("served");
    expect(res.body.message).toContain("meal");
  });

  it("200 — returns correct message for cancelled status", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockKotDoc({ status: "cancelled" })),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.message).toContain("cancelled");
  });

  it("200 — no auth required (public route)", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockKotDoc()),
      }),
    });

    // No token — should still work
    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(200);
  });

  it("404 — returns 404 when order not found", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("500 — returns 500 when DB throws", async () => {
    Kot.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error("DB error")),
      }),
    });

    const res = await request(app).get(
      `/api/v1/public/order/${VALID_ORDER_ID}/status`,
    );

    expect(res.status).toBe(500);
  });
});
