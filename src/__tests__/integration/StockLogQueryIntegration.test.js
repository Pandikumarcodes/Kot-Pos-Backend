const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "stock_log_query_test_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../config/logger", () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
}));
jest.mock("../../repositories/StockLogRepository", () => ({
  listForInventory: jest.fn(), count: jest.fn(),
}));

const User = require("../../models/users");
const { mockActiveBranch } = require("../helpers/mockBranch");
const stockLogRepository = require("../../repositories/StockLogRepository");
const inventoryRouter = require("../../routes/admin/InventoryRouter");

const BRANCH_A = "64b000000000000000000001";
const BRANCH_B = "64b000000000000000000002";
const INVENTORY_ID = "64d000000000000000000001";

const logs = [
  { _id: "1", branchId: BRANCH_A, inventoryId: INVENTORY_ID, type: "restock", quantity: 10, createdAt: "2026-01-01" },
  { _id: "2", branchId: BRANCH_A, inventoryId: INVENTORY_ID, type: "adjustment", quantity: -2, createdAt: "2026-01-02" },
  { _id: "3", branchId: BRANCH_A, inventoryId: INVENTORY_ID, type: "restock", quantity: 20, createdAt: "2026-01-03" },
  { _id: "4", branchId: BRANCH_B, inventoryId: INVENTORY_ID, type: "restock", quantity: 99, createdAt: "2026-01-04" },
  { _id: "5", branchId: BRANCH_A, inventoryId: "64d000000000000000000002", type: "restock", quantity: 50, createdAt: "2026-01-05" },
];

const matches = (item, filter = {}) => Object.entries(filter).every(([key, value]) => {
  if (key === "$and") return value.every((part) => matches(item, part));
  return String(item[key]) === String(value);
});

const select = (filter, { sort = {}, skip = 0, limit = 50 } = {}) => {
  const selected = logs.filter((item) => matches(item, filter)).sort((left, right) => {
    for (const [field, direction] of Object.entries(sort)) {
      const compared = String(left[field]).localeCompare(String(right[field]), undefined, { numeric: true });
      if (compared) return compared * direction;
    }
    return 0;
  });
  return selected.slice(skip, skip + limit);
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin/inventory", inventoryRouter);

const token = jwt.sign(
  { _id: "stock-admin", role: "admin", branchId: BRANCH_A },
  process.env.JWT_SECRET,
  { expiresIn: "15m" },
);
const getLogs = (query = "") => request(app)
  .get(`/api/v1/admin/inventory/${INVENTORY_ID}/logs${query}`)
  .set("Cookie", `token=${token}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveBranch(BRANCH_A);
  User.findById.mockResolvedValue({
    _id: "stock-admin", role: "admin", status: "active", branchId: BRANCH_A,
  });
  stockLogRepository.listForInventory.mockImplementation(async (inventoryId, branchId, options) => {
    const filter = options?.filter || { inventoryId, branchId };
    return select(filter, options);
  });
  stockLogRepository.count.mockImplementation(async (filter) =>
    logs.filter((item) => matches(item, filter)).length);
});

describe("Stock Log query integration", () => {
  test("supports pagination with one lean data query and one count query", async () => {
    const response = await getLogs("?page=2&limit=1");
    expect(response.status).toBe(200);
    expect(response.body.logs.map((item) => item._id)).toEqual(["2"]);
    expect(response.body.pagination).toMatchObject({ page: 2, limit: 1, total: 3, pages: 3 });
    expect(stockLogRepository.listForInventory).toHaveBeenCalledTimes(1);
    expect(stockLogRepository.listForInventory.mock.calls[0][2]).toMatchObject({ lean: true, skip: 1, limit: 1 });
    expect(stockLogRepository.listForInventory.mock.calls[0][2].projection).toEqual(expect.objectContaining({ type: 1, createdAt: 1 }));
    expect(stockLogRepository.count).toHaveBeenCalledTimes(1);
  });

  test("supports type filtering and approved deterministic sorting", async () => {
    const response = await getLogs("?type=restock&sort=quantity&order=desc");
    expect(response.status).toBe(200);
    expect(response.body.logs.map((item) => item.quantity)).toEqual([20, 10]);
    expect(response.body.pagination).toBeUndefined();
    expect(stockLogRepository.count).not.toHaveBeenCalled();
    expect(stockLogRepository.listForInventory.mock.calls[0][2].sort).toEqual({ quantity: -1, _id: -1 });
  });

  test("rejects unsupported search, sort, filters and invalid pagination", async () => {
    expect((await getLogs("?search=restock.*")).status).toBe(400);
    expect((await getLogs("?sort=doneBy")).status).toBe(400);
    expect((await getLogs("?status=active")).status).toBe(400);
    expect((await getLogs("?type=unknown")).status).toBe(400);
    expect((await getLogs("?page=0")).status).toBe(400);
    expect((await getLogs("?limit=101")).status).toBe(400);
  });

  test("preserves trusted branch and inventory isolation", async () => {
    const response = await getLogs(`?page=1&limit=100&branchId=${BRANCH_B}`);
    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(3);
    expect(response.body.logs.every((item) => item.branchId === BRANCH_A)).toBe(true);
    expect(response.body.logs.every((item) => item.inventoryId === INVENTORY_ID)).toBe(true);
  });

  test("preserves the legacy logs response and 50-row repository behavior", async () => {
    const response = await getLogs();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ logs: expect.any(Array) });
    expect(stockLogRepository.listForInventory).toHaveBeenCalledWith(
      INVENTORY_ID,
      BRANCH_A,
    );
    expect(stockLogRepository.count).not.toHaveBeenCalled();
  });
});
