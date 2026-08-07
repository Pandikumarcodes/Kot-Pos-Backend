const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "master_data_query_test_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../config/logger", () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
}));
jest.mock("../../repositories/UserRepository", () => ({
  findByScope: jest.fn(), findByAccess: jest.fn(), count: jest.fn(), countByAccess: jest.fn(),
}));
jest.mock("../../repositories/MenuRepository", () => ({
  listAll: jest.fn(), count: jest.fn(),
}));
jest.mock("../../repositories/CustomerRepository", () => ({
  listByLastVisit: jest.fn(), count: jest.fn(),
}));

const User = require("../../models/users");
const userRepository = require("../../repositories/UserRepository");
const menuRepository = require("../../repositories/MenuRepository");
const customerRepository = require("../../repositories/CustomerRepository");
const { adminUserRouter } = require("../../routes/admin/adminUser");
const { adminMenuRouter } = require("../../routes/admin/adminMenu");
const { adminCustomerRouter } = require("../../routes/admin/adminCustomerRouter");

const BRANCH_A = "64b000000000000000000001";
const BRANCH_B = "64b000000000000000000002";

const staff = [
  { _id: "1", username: "Anita", role: "manager", status: "active", branchId: BRANCH_A, createdAt: "2026-01-01" },
  { _id: "2", username: "Bala", role: "waiter", status: "locked", branchId: BRANCH_A, createdAt: "2026-01-02" },
  { _id: "3", username: "Chitra", role: "waiter", status: "active", branchId: BRANCH_A, createdAt: "2026-01-03" },
  { _id: "4", username: "Other Branch", role: "manager", status: "active", branchId: BRANCH_B, createdAt: "2026-01-04" },
];

const menu = [
  { _id: "11", ItemName: "Apple Juice", category: "beverage", price: 80, available: true },
  { _id: "12", ItemName: "Brownie", category: "dessert", price: 120, available: false },
  { _id: "13", ItemName: "Cold Coffee", category: "beverage", price: 100, available: true },
];

const customers = [
  { _id: "21", name: "Arun", phone: "9000000001", createdAt: "2026-01-01" },
  { _id: "22", name: "Bina", phone: "9000000002", createdAt: "2026-01-02" },
  { _id: "23", name: "Charan", phone: "8111111111", createdAt: "2026-01-03" },
];

const matches = (item, filter = {}) => Object.entries(filter).every(([key, value]) => {
  if (key === "$and") return value.every((part) => matches(item, part));
  if (key === "$or") return value.some((part) => matches(item, part));
  if (value && value.$regex !== undefined) {
    return new RegExp(value.$regex, value.$options).test(String(item[key] ?? ""));
  }
  return String(item[key]) === String(value);
});

const sortedPage = (items, filter, { sort = {}, skip = 0, limit } = {}) => {
  const result = items.filter((item) => matches(item, filter)).sort((left, right) => {
    for (const [field, direction] of Object.entries(sort)) {
      const compared = String(left[field]).localeCompare(String(right[field]), undefined, { numeric: true });
      if (compared) return compared * direction;
    }
    return 0;
  });
  return result.slice(skip, limit === undefined ? undefined : skip + limit);
};

const makeApp = (mount, router) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(mount, router);
  return app;
};

const staffApp = makeApp("/api/v1/admin", adminUserRouter);
const menuApp = makeApp("/api/v1/admin", adminMenuRouter);
const customerApp = makeApp("/api/v1/admin", adminCustomerRouter);
const token = jwt.sign(
  { _id: "query-admin", role: "admin", branchId: BRANCH_A },
  process.env.JWT_SECRET,
  { expiresIn: "15m" },
);
const get = (app, path) => request(app).get(path).set("Cookie", `token=${token}`);

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({
    _id: "query-admin", role: "admin", status: "active", branchId: BRANCH_A,
  });
  userRepository.findByScope.mockImplementation(async (filter, options) =>
    sortedPage(staff, filter, options));
  userRepository.findByAccess.mockImplementation(async ({ scope, filter = {}, options = {} }) =>
    sortedPage(staff, { ...filter, branchId: scope.branchId }, options));
  userRepository.count.mockImplementation(async (filter) =>
    staff.filter((item) => matches(item, filter)).length);
  userRepository.countByAccess.mockImplementation(async (scope, filter = {}) =>
    staff.filter((item) => matches(item, { ...filter, branchId: scope.branchId })).length);
  menuRepository.listAll.mockImplementation(async ({ filter, ...options } = {}) =>
    sortedPage(menu, filter, options));
  menuRepository.count.mockImplementation(async (filter) =>
    menu.filter((item) => matches(item, filter)).length);
  customerRepository.listByLastVisit.mockImplementation(async ({ filter, ...options } = {}) =>
    sortedPage(customers, filter, options));
  customerRepository.count.mockImplementation(async (filter) =>
    customers.filter((item) => matches(item, filter)).length);
});

describe("Staff query integration", () => {
  test("supports pagination with one lean data query and one count query", async () => {
    const response = await get(staffApp, "/api/v1/admin/users?page=2&limit=1");
    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 2, limit: 1, total: 3, pages: 3 });
    expect(userRepository.findByAccess).toHaveBeenCalledTimes(1);
    expect(userRepository.findByAccess.mock.calls[0][0]).toMatchObject({ scope: expect.objectContaining({ branchId: BRANCH_A }) });
    expect(userRepository.countByAccess).toHaveBeenCalledTimes(1);
  });

  test("searches username and supports approved sorting and existing filters", async () => {
    const response = await get(staffApp, "/api/v1/admin/users?search=a&role=waiter&status=active&sort=name&order=desc");
    expect(response.status).toBe(200);
    expect(response.body.users.map((item) => item.username)).toEqual(["Chitra"]);
    expect(response.body.pagination).toBeUndefined();
    expect(userRepository.count).not.toHaveBeenCalled();
  });

  test("rejects invalid sort and filters while preserving trusted branch scope", async () => {
    expect((await get(staffApp, "/api/v1/admin/users?sort=password")).status).toBe(400);
    expect((await get(staffApp, "/api/v1/admin/users?active=true")).status).toBe(400);
    const scoped = await get(staffApp, `/api/v1/admin/users?page=1&branchId=${BRANCH_B}`);
    expect(scoped.status).toBe(403);
  });
});

describe("Menu query integration", () => {
  test("supports pagination, category search/filter and deterministic sorting", async () => {
    const response = await get(menuApp, "/api/v1/admin/menuItems?search=beverage&category=beverage&sort=price&order=desc&page=1&limit=1");
    expect(response.status).toBe(200);
    expect(response.body.menuItems.map((item) => item.ItemName)).toEqual(["Cold Coffee"]);
    expect(response.body.pagination.total).toBe(2);
    expect(menuRepository.listAll).toHaveBeenCalledTimes(1);
    expect(menuRepository.count).toHaveBeenCalledTimes(1);
  });

  test("supports the existing availability field through its public filter", async () => {
    const response = await get(menuApp, "/api/v1/admin/menuItems?availability=false&sort=name");
    expect(response.status).toBe(200);
    expect(response.body.menuItems.map((item) => item.ItemName)).toEqual(["Brownie"]);
  });

  test("rejects unknown sort/filter and escapes regex search", async () => {
    expect((await get(menuApp, "/api/v1/admin/menuItems?sort=createdAt")).status).toBe(400);
    expect((await get(menuApp, "/api/v1/admin/menuItems?status=active")).status).toBe(400);
    const escaped = await get(menuApp, "/api/v1/admin/menuItems?search=Coffee.*");
    expect(escaped.status).toBe(200);
    expect(escaped.body.menuItems).toEqual([]);
  });
});

describe("Customer query integration", () => {
  test("supports pagination with concurrent data/count queries", async () => {
    const response = await get(customerApp, "/api/v1/admin/customers?page=1&limit=2");
    expect(response.status).toBe(200);
    expect(response.body.customers).toHaveLength(2);
    expect(response.body.pagination.total).toBe(3);
    expect(customerRepository.listByLastVisit).toHaveBeenCalledTimes(1);
    expect(customerRepository.count).toHaveBeenCalledTimes(1);
  });

  test("searches name and phone and sorts only approved fields", async () => {
    const byName = await get(customerApp, "/api/v1/admin/customers?search=bi&sort=name&order=asc");
    const byPhone = await get(customerApp, "/api/v1/admin/customers?search=8111&sort=createdAt&order=desc");
    expect(byName.body.customers.map((item) => item.name)).toEqual(["Bina"]);
    expect(byPhone.body.customers.map((item) => item.name)).toEqual(["Charan"]);
    expect(byName.body.pagination).toBeUndefined();
  });

  test("rejects invalid pagination, sorting, search and nonexistent filters", async () => {
    expect((await get(customerApp, "/api/v1/admin/customers?page=0")).status).toBe(400);
    expect((await get(customerApp, "/api/v1/admin/customers?limit=101")).status).toBe(400);
    expect((await get(customerApp, "/api/v1/admin/customers?sort=phone")).status).toBe(400);
    expect((await get(customerApp, "/api/v1/admin/customers?active=true")).status).toBe(400);
    expect((await get(customerApp, `/api/v1/admin/customers?search=${"x".repeat(101)}`)).status).toBe(400);
  });
});
