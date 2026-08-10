const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "inventory_query_test_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock("../../repositories/InventoryRepository", () => ({
  findActive: jest.fn(),
  count: jest.fn(),
}));

const User = require("../../models/users");
const { mockActiveBranch } = require("../helpers/mockBranch");
const inventoryRepository = require("../../repositories/InventoryRepository");
const inventoryRouter = require("../../routes/admin/InventoryRouter");

const BRANCH_A = "64b000000000000000000001";
const BRANCH_B = "64b000000000000000000002";
const BRANCH_A_OBJECT_ID = new mongoose.Types.ObjectId(BRANCH_A);

const makeItem = (index, overrides = {}) => ({
  _id: String(index).padStart(24, "0"),
  branchId: BRANCH_A,
  name: `Item ${String(index).padStart(3, "0")}`,
  unit: "kg",
  currentStock: index,
  lowStockThreshold: 10,
  category: index % 2 ? "raw_material" : "produce",
  costPerUnit: index,
  supplier: "",
  isActive: true,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 0, 2, 0, 0, index % 60)).toISOString(),
  ...overrides,
});

const inventory = [
  ...Array.from({ length: 130 }, (_, index) => makeItem(index + 1)),
  makeItem(201, {
    name: "Basmati Rice",
    category: "raw_material",
    currentStock: 4,
  }),
  makeItem(202, {
    name: "Brown rice",
    category: "raw_material",
    currentStock: 12,
  }),
  makeItem(203, {
    branchId: BRANCH_B,
    name: "Branch B Rice",
    category: "raw_material",
    currentStock: 1,
  }),
];

const matches = (item, filter) => {
  if (!filter || Object.keys(filter).length === 0) return true;
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$and") return value.every((part) => matches(item, part));
    if (key === "$or") return value.some((part) => matches(item, part));
    if (key === "$expr") {
      return item.currentStock <= item.lowStockThreshold;
    }
    if (value && value.$regex !== undefined) {
      return new RegExp(value.$regex, value.$options).test(item[key]);
    }
    return String(item[key]) === String(value);
  });
};

const compareBySort = (sort) => (left, right) => {
  for (const [field, direction] of Object.entries(sort)) {
    const comparison = String(left[field]).localeCompare(String(right[field]),
      undefined, { numeric: true });
    if (comparison !== 0) return comparison * direction;
  }
  return 0;
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin/inventory", inventoryRouter);

const token = jwt.sign(
  { _id: "inventory-query-user", role: "manager", branchId: BRANCH_A },
  process.env.JWT_SECRET,
  { expiresIn: "15m" },
);

const getInventory = (query = "") =>
  request(app)
    .get(`/api/v1/admin/inventory${query}`)
    .set("Cookie", `token=${token}`);

describe("Inventory query integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveBranch(BRANCH_A);
    User.findById.mockResolvedValue({
      _id: "inventory-query-user",
      role: "manager",
      branchId: BRANCH_A_OBJECT_ID,
      status: "active",
    });
    inventoryRepository.findActive.mockImplementation(
      async (filter, { sort, skip, limit }) =>
        inventory
          .filter((item) => matches(item, filter))
          .sort(compareBySort(sort))
          .slice(skip, skip + limit)
          .map((item) => ({ ...item })),
    );
    inventoryRepository.count.mockImplementation(async (filter) =>
      inventory.filter((item) => matches(item, filter)).length,
    );
  });

  test("returns the first page with one data query and one count query", async () => {
    const response = await getInventory("?page=1&limit=20");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(20);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 132,
      pages: 7,
      hasNext: true,
      hasPrev: false,
    });
    expect(inventoryRepository.findActive).toHaveBeenCalledTimes(1);
    expect(inventoryRepository.count).toHaveBeenCalledTimes(1);
    const dataFilter = inventoryRepository.findActive.mock.calls[0][0];
    const countFilter = inventoryRepository.count.mock.calls[0][0];
    const dataBranchId = dataFilter.$and.find((part) => part.branchId).branchId;
    const countBranchId = countFilter.$and.find((part) => part.branchId).branchId;
    expect(dataBranchId).toBe(BRANCH_A_OBJECT_ID);
    expect(dataBranchId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(countBranchId).toBe(BRANCH_A_OBJECT_ID);
  });

  test("returns the second page", async () => {
    const first = await getInventory("?page=1&limit=20");
    const second = await getInventory("?page=2&limit=20");

    expect(second.status).toBe(200);
    expect(second.body.pagination.page).toBe(2);
    expect(second.body.items[0]._id).not.toBe(first.body.items[0]._id);
  });

  test("allows the maximum limit and rejects values above it", async () => {
    const maximum = await getInventory("?limit=100");
    const aboveMaximum = await getInventory("?limit=101");

    expect(maximum.status).toBe(200);
    expect(maximum.body.items).toHaveLength(100);
    expect(maximum.body.pagination.limit).toBe(100);
    expect(aboveMaximum.status).toBe(400);
  });

  test.each(["?page=0", "?page=-1", "?page=1.5", "?page=abc"])(
    "rejects an invalid page: %s",
    async (query) => {
      expect((await getInventory(query)).status).toBe(400);
    },
  );

  test("supports partial, case-insensitive search", async () => {
    const partial = await getInventory("?search=basmati");
    const caseInsensitive = await getInventory("?search=RICE");

    expect(partial.body.items.map((item) => item.name)).toEqual([
      "Basmati Rice",
    ]);
    expect(caseInsensitive.body.items.map((item) => item.name).sort()).toEqual([
      "Basmati Rice",
      "Brown rice",
    ]);
  });

  test("treats empty search as no search filter", async () => {
    const response = await getInventory("?search=");

    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(132);
  });

  test("escapes regex metacharacters in search", async () => {
    const response = await getInventory("?search=Rice.*");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);
  });

  test("sorts by an approved field in ascending and descending order", async () => {
    const ascending = await getInventory("?sort=name&order=asc&limit=100");
    const descending = await getInventory("?sort=name&order=desc&limit=100");

    expect(ascending.body.items[0].name).toBe("Basmati Rice");
    expect(descending.body.items[0].name).toBe("Item 130");
  });

  test("rejects an invalid sort field", async () => {
    const response = await getInventory("?sort=branchId&order=asc");

    expect(response.status).toBe(400);
    expect(inventoryRepository.findActive).not.toHaveBeenCalled();
  });

  test("filters by category", async () => {
    const response = await getInventory("?category=produce&limit=100");

    expect(response.status).toBe(200);
    expect(response.body.items.every((item) => item.category === "produce"))
      .toBe(true);
    expect(response.body.pagination.total).toBe(65);
  });

  test("filters low-stock items with the existing field comparison", async () => {
    const response = await getInventory("?lowStock=true&limit=100");

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.every((item) => item.isLowStock)).toBe(true);
  });

  test("rejects unsupported status and arbitrary filters", async () => {
    expect((await getInventory("?status=active")).status).toBe(400);
    expect((await getInventory("?supplier=vendor")).status).toBe(400);
  });

  test("preserves trusted branch isolation when the client supplies another branch", async () => {
    const response = await getInventory(`?branchId=${BRANCH_B}&search=rice`);

    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.name).sort()).toEqual([
      "Basmati Rice",
      "Brown rice",
    ]);
    expect(response.body.items.every((item) => item.branchId === BRANCH_A))
      .toBe(true);
  });

  test("combines search, filter, sort and pagination", async () => {
    const response = await getInventory(
      "?search=rice&category=raw_material&sort=name&order=desc&page=1&limit=1",
    );

    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.name)).toEqual([
      "Brown rice",
    ]);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      pages: 2,
      hasNext: true,
    });
  });

  test("preserves legacy Inventory keys and default stock ordering", async () => {
    const response = await getInventory();

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        lowStockCount: expect.any(Number),
        pagination: expect.any(Object),
      }),
    );
    expect(response.body.items[0].currentStock).toBeLessThanOrEqual(
      response.body.items[1].currentStock,
    );
  });
});
