const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/customer");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../../models/users");
const Customer = require("../../models/customer");
const {
  adminCustomerRouter,
} = require("../../routes/admin/adminCustomerRouter");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminCustomerRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_CUSTOMER_ID = new mongoose.Types.ObjectId().toString();
const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

function makeToken(role = "admin", branchId = VALID_BRANCH_ID) {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "admin") {
  return {
    _id: "user_id_123",
    username: "testuser",
    role,
    branchId: VALID_BRANCH_ID,
  };
}

function mockCustomerDoc(overrides = {}) {
  return {
    _id: VALID_CUSTOMER_ID,
    name: "Ravi Kumar",
    phone: "9876543210",
    email: "ravi@example.com",
    address: "123 MG Road",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/customers
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/customers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch all customers", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockCustomerDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(1);
  });

  it("200 — manager can fetch all customers", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Customer.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockCustomerDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("200 — returns empty array when no customers", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.customers).toEqual([]);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/customers");
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot fetch customers", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — cashier cannot fetch customers", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .get("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/customers/:customerId
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/customers/:customerId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns a single customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findById.mockResolvedValue(mockCustomerDoc());

    const res = await request(app)
      .get(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe("Ravi Kumar");
  });

  it("404 — returns 404 when customer not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Customer not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(
      `/api/v1/admin/customers/${VALID_CUSTOMER_ID}`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/customers
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/customers", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    name: "Ravi Kumar",
    phone: "9876543210",
    email: "ravi@example.com",
    address: "123 MG Road",
  };

  it("201 — admin can create a customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findOne.mockResolvedValue(null);
    Customer.create.mockResolvedValue(mockCustomerDoc());

    const res = await request(app)
      .post("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Customer created");
  });

  it("400 — rejects missing name", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .post("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ phone: "9876543210" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Name and phone are required");
  });

  it("400 — rejects missing phone", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .post("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ name: "Ravi Kumar" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Name and phone are required");
  });

  it("400 — rejects duplicate phone number", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findOne.mockResolvedValue(mockCustomerDoc());

    const res = await request(app)
      .post("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Customer with this phone already exists");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/customers")
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot create a customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .post("/api/v1/admin/customers")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/customers/:customerId
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/customers/:customerId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can update a customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findByIdAndUpdate.mockResolvedValue(
      mockCustomerDoc({ name: "Ravi Updated" }),
    );

    const res = await request(app)
      .put(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ name: "Ravi Updated", phone: "9876543210" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Customer updated");
  });

  it("400 — rejects invalid customer ID", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .put("/api/v1/admin/customers/invalid_id")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ name: "Ravi" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid customer ID");
  });

  it("404 — returns 404 when customer not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ name: "Ravi" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Customer not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .send({ name: "Ravi" });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/customers/:customerId
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/admin/customers/:customerId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can delete a customer", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findByIdAndDelete.mockResolvedValue(mockCustomerDoc());

    const res = await request(app)
      .delete(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Customer deleted");
  });

  it("400 — rejects invalid customer ID", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));

    const res = await request(app)
      .delete("/api/v1/admin/customers/invalid_id")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid customer ID");
  });

  it("404 — returns 404 when customer not found", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Customer.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Customer not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).delete(
      `/api/v1/admin/customers/${VALID_CUSTOMER_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — manager cannot delete a customer (admin only)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));

    const res = await request(app)
      .delete(`/api/v1/admin/customers/${VALID_CUSTOMER_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });
});
