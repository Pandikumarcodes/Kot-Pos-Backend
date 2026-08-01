const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "operational_query_test_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../config/logger", () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
}));
jest.mock("../../repositories/OrderRepository", () => ({
  listScoped: jest.fn(), countScoped: jest.fn(),
}));
jest.mock("../../repositories/BillingRepository", () => ({
  listScoped: jest.fn(), count: jest.fn(),
}));
jest.mock("../../repositories/KitchenRepository", () => ({
  listActive: jest.fn(), countByFilter: jest.fn(),
}));
jest.mock("../../repositories/TakeawayOrderRepository", () => ({
  listScoped: jest.fn(), count: jest.fn(),
}));

const User = require("../../models/users");
const orderRepository = require("../../repositories/OrderRepository");
const billingRepository = require("../../repositories/BillingRepository");
const kitchenRepository = require("../../repositories/KitchenRepository");
const takeawayRepository = require("../../repositories/TakeawayOrderRepository");
const { waiterOrderRouter } = require("../../routes/waiter/waiterOrderRouter");
const { cashierbillingRouter } = require("../../routes/cashier/cashierBilling");
const { chefRouter } = require("../../routes/chef/chefRouter");
const { cashierKotRouter } = require("../../routes/cashier/cashierKotOrder");

const BRANCH_A = "64b000000000000000000001";
const BRANCH_B = "64b000000000000000000002";
const MEMBER_A = "64c000000000000000000001";
const MEMBER_B = "64c000000000000000000002";

const orders = [
  { _id: "1", createdBy: MEMBER_A, customerName: "Asha", status: "pending", createdAt: "2026-01-01" },
  { _id: "2", createdBy: MEMBER_A, customerName: "Bala", status: "served", createdAt: "2026-01-02" },
  { _id: "3", createdBy: MEMBER_A, customerName: "Cathy", status: "pending", createdAt: "2026-01-03" },
  { _id: "4", createdBy: MEMBER_B, customerName: "Other", status: "pending", createdAt: "2026-01-04" },
];
const bills = [
  { _id: "11", createdBy: MEMBER_A, customerName: "Asha", customerPhone: "9000000001", billNumber: "BILL-001", paymentStatus: "unpaid", createdAt: "2026-01-01" },
  { _id: "12", createdBy: MEMBER_A, customerName: "Bala", customerPhone: "9000000002", billNumber: "BILL-002", paymentStatus: "paid", createdAt: "2026-01-02" },
  { _id: "13", createdBy: MEMBER_B, customerName: "Other", customerPhone: "8000000000", billNumber: "BILL-003", paymentStatus: "paid", createdAt: "2026-01-03" },
];
const kitchenOrders = [
  { _id: "21", branchId: BRANCH_A, status: "pending", createdAt: "2026-01-01" },
  { _id: "22", branchId: BRANCH_A, status: "ready", createdAt: "2026-01-02" },
  { _id: "23", branchId: BRANCH_A, status: "cancelled", createdAt: "2026-01-03" },
  { _id: "24", branchId: BRANCH_B, status: "pending", createdAt: "2026-01-04" },
];
const takeawayOrders = [
  { _id: "31", createdBy: MEMBER_A, customerName: "Asha", status: "pending", createdAt: "2026-01-01" },
  { _id: "32", createdBy: MEMBER_A, customerName: "Bala", status: "received", createdAt: "2026-01-02" },
  { _id: "33", createdBy: MEMBER_B, customerName: "Other", status: "pending", createdAt: "2026-01-03" },
];

const matches = (item, filter = {}) => Object.entries(filter).every(([key, value]) => {
  if (key === "$and") return value.every((part) => matches(item, part));
  if (key === "$or") return value.some((part) => matches(item, part));
  if (value && value.$regex !== undefined) {
    return new RegExp(value.$regex, value.$options).test(String(item[key] ?? ""));
  }
  if (value && Array.isArray(value.$in)) {
    return value.$in.some((candidate) => String(candidate) === String(item[key]));
  }
  return String(item[key]) === String(value);
});

const select = (data, filter, { sort = {}, skip = 0, limit } = {}) => {
  const selected = data.filter((item) => matches(item, filter)).sort((left, right) => {
    for (const [field, direction] of Object.entries(sort)) {
      const compared = String(left[field]).localeCompare(String(right[field]), undefined, { numeric: true });
      if (compared) return compared * direction;
    }
    return 0;
  });
  return selected.slice(skip, limit === undefined ? undefined : skip + limit);
};

const appFor = (mount, router) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(mount, router);
  return app;
};

const waiterApp = appFor("/api/v1/waiter", waiterOrderRouter);
const billingApp = appFor("/api/v1/cashier", cashierbillingRouter);
const kitchenApp = appFor("/api/v1/chef", chefRouter);
const takeawayApp = appFor("/api/v1/cashier", cashierKotRouter);
const tokenFor = (role) => jwt.sign(
  { _id: MEMBER_A, role, branchId: BRANCH_A },
  process.env.JWT_SECRET,
  { expiresIn: "15m" },
);
const get = (app, path, role) => request(app).get(path)
  .set("Cookie", `token=${tokenFor(role)}`);

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockImplementation(async () => ({
    _id: MEMBER_A, role: "admin", status: "active", branchId: BRANCH_A,
  }));
  User.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue([MEMBER_A]) });
  orderRepository.listScoped.mockImplementation(async (filter, options) => select(orders, filter, options));
  orderRepository.countScoped.mockImplementation(async (filter) => orders.filter((item) => matches(item, filter)).length);
  billingRepository.listScoped.mockImplementation(async (filter, options) => select(bills, filter, options));
  billingRepository.count.mockImplementation(async (filter) => bills.filter((item) => matches(item, filter)).length);
  kitchenRepository.listActive.mockImplementation(async (filter, options) => select(kitchenOrders, filter, options));
  kitchenRepository.countByFilter.mockImplementation(async (filter) => kitchenOrders.filter((item) => matches(item, filter)).length);
  takeawayRepository.listScoped.mockImplementation(async (filter, options) => select(takeawayOrders, filter, options));
  takeawayRepository.count.mockImplementation(async (filter) => takeawayOrders.filter((item) => matches(item, filter)).length);
});

describe("Orders query integration", () => {
  test("supports pagination, deterministic sorting and existing status filtering", async () => {
    const response = await get(waiterApp, "/api/v1/waiter/orders?status=pending&sort=createdAt&order=desc&page=1&limit=1", "waiter");
    expect(response.status).toBe(200);
    expect(response.body.myOrders.map((item) => item._id)).toEqual(["3"]);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 1, total: 2, pages: 2 });
    expect(orderRepository.listScoped).toHaveBeenCalledTimes(1);
    expect(orderRepository.listScoped.mock.calls[0][1]).toMatchObject({ lean: true, skip: 0, limit: 1 });
    expect(orderRepository.countScoped).toHaveBeenCalledTimes(1);
  });

  test("does not invent search and rejects invalid query values", async () => {
    expect((await get(waiterApp, "/api/v1/waiter/orders?search=Asha", "waiter")).status).toBe(400);
    expect((await get(waiterApp, "/api/v1/waiter/orders?sort=customerName", "waiter")).status).toBe(400);
    expect((await get(waiterApp, "/api/v1/waiter/orders?status=unknown", "waiter")).status).toBe(400);
    expect((await get(waiterApp, "/api/v1/waiter/orders?page=0", "waiter")).status).toBe(400);
  });

  test("preserves member scope when a client supplies another branch", async () => {
    const response = await get(waiterApp, `/api/v1/waiter/orders?page=1&branchId=${BRANCH_B}`, "waiter");
    expect(response.body.myOrders.every((item) => item.createdBy === MEMBER_A)).toBe(true);
  });
});

describe("Billing query integration", () => {
  test("supports existing search, status filter, sorting and pagination", async () => {
    const response = await get(billingApp, "/api/v1/cashier/bills?search=BILL&status=paid&sort=billDate&order=desc&page=1&limit=1", "cashier");
    expect(response.status).toBe(200);
    expect(response.body.myBills.map((item) => item.billNumber)).toEqual(["BILL-002"]);
    expect(response.body.pagination.total).toBe(1);
    expect(billingRepository.listScoped).toHaveBeenCalledTimes(1);
    expect(billingRepository.count).toHaveBeenCalledTimes(1);
  });

  test("escapes regex search and rejects invalid fields and filters", async () => {
    expect((await get(billingApp, "/api/v1/cashier/bills?search=BILL-.*", "cashier")).status).toBe(404);
    expect((await get(billingApp, "/api/v1/cashier/bills?sort=totalAmount", "cashier")).status).toBe(400);
    expect((await get(billingApp, "/api/v1/cashier/bills?paymentStatus=paid", "cashier")).status).toBe(400);
    expect((await get(billingApp, "/api/v1/cashier/bills?limit=101", "cashier")).status).toBe(400);
  });
});

describe("Kitchen query integration", () => {
  test("supports pagination, sorting and active status filtering", async () => {
    const response = await get(kitchenApp, "/api/v1/chef/kot?status=ready&sort=status&order=asc&page=1&limit=10", "chef");
    expect(response.status).toBe(200);
    expect(response.body.KotOrders.map((item) => item._id)).toEqual(["22"]);
    expect(response.body.pagination.total).toBe(1);
    expect(kitchenRepository.listActive).toHaveBeenCalledTimes(1);
    expect(kitchenRepository.countByFilter).toHaveBeenCalledTimes(1);
  });

  test("keeps active workflow and rejects unsupported search/filter values", async () => {
    const active = await get(kitchenApp, "/api/v1/chef/kot?sort=createdAt", "chef");
    expect(active.body.KotOrders.map((item) => item._id)).toEqual(["21", "22"]);
    expect((await get(kitchenApp, "/api/v1/chef/kot?status=cancelled", "chef")).status).toBe(400);
    expect((await get(kitchenApp, "/api/v1/chef/kot?search=Asha", "chef")).status).toBe(400);
  });
});

describe("Takeaway query integration", () => {
  test("supports pagination, sorting and existing status filtering", async () => {
    const response = await get(takeawayApp, "/api/v1/cashier/takeaway-orders?status=pending&sort=createdAt&order=asc&page=1&limit=10", "cashier");
    expect(response.status).toBe(200);
    expect(response.body.myOrders.map((item) => item._id)).toEqual(["31"]);
    expect(response.body.pagination.total).toBe(1);
    expect(takeawayRepository.listScoped).toHaveBeenCalledTimes(1);
    expect(takeawayRepository.count).toHaveBeenCalledTimes(1);
  });

  test("does not invent search and rejects unknown query parameters", async () => {
    expect((await get(takeawayApp, "/api/v1/cashier/takeaway-orders?search=Asha", "cashier")).status).toBe(400);
    expect((await get(takeawayApp, "/api/v1/cashier/takeaway-orders?customerName=Asha", "cashier")).status).toBe(400);
    expect((await get(takeawayApp, "/api/v1/cashier/takeaway-orders?sort=customerName", "cashier")).status).toBe(400);
  });
});

test("legacy list responses remain unpaginated and do not issue count queries", async () => {
  const [orderResponse, billResponse, kitchenResponse, takeawayResponse] = await Promise.all([
    get(waiterApp, "/api/v1/waiter/orders", "waiter"),
    get(billingApp, "/api/v1/cashier/bills", "cashier"),
    get(kitchenApp, "/api/v1/chef/kot", "chef"),
    get(takeawayApp, "/api/v1/cashier/takeaway-orders", "cashier"),
  ]);
  expect(orderResponse.body).toHaveProperty("myOrders");
  expect(billResponse.body).toHaveProperty("myBills");
  expect(kitchenResponse.body).toHaveProperty("KotOrders");
  expect(takeawayResponse.body).toHaveProperty("myOrders");
  for (const response of [orderResponse, billResponse, kitchenResponse, takeawayResponse]) {
    expect(response.body.pagination).toBeUndefined();
  }
  expect(orderRepository.countScoped).not.toHaveBeenCalled();
  expect(billingRepository.count).not.toHaveBeenCalled();
  expect(kitchenRepository.countByFilter).not.toHaveBeenCalled();
  expect(takeawayRepository.count).not.toHaveBeenCalled();
});
