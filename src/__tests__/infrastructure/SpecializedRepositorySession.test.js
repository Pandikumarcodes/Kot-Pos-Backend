jest.mock("../../models/Inventory", () => ({
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../../models/billings", () => ({
  aggregate: jest.fn(),
}));
jest.mock("../../models/kot", () => ({
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock("../../models/waiter", () => ({
  countDocuments: jest.fn(),
}));
jest.mock("../../models/tables", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

const Inventory = require("../../models/Inventory");
const Billing = require("../../models/billings");
const Table = require("../../models/tables");
const InventoryRepository = require("../../repositories/InventoryRepository");
const ReportRepository = require("../../repositories/ReportRepository");
const TableRepository = require("../../repositories/TableRepository");

describe("specialized repository session forwarding", () => {
  test("forwards the session through direct update queries", () => {
    const session = { id: "session" };

    InventoryRepository.updateScoped(
      "inventory-id",
      { branchId: "branch-id" },
      { currentStock: 4 },
      { session },
    );

    expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "inventory-id", branchId: "branch-id" },
      { currentStock: 4 },
      { new: true, runValidators: true, session },
    );
  });

  test("forwards the session through aggregate queries", () => {
    const session = { id: "session" };

    ReportRepository.getRevenueSummary({ branchId: "branch-id" }, { session });

    expect(Billing.aggregate).toHaveBeenCalledWith(
      expect.any(Array),
      { session },
    );
  });

  test("scopes table reads and mutations by branch while forwarding sessions", () => {
    const session = { id: "session" };

    TableRepository.findByIdAndBranch("table-id", "branch-id", { session });
    TableRepository.updateByIdAndBranch(
      "table-id",
      "branch-id",
      { status: "billing" },
      { session },
    );
    TableRepository.deleteByIdAndBranch("table-id", "branch-id", { session });

    expect(Table.findOne).toHaveBeenCalledWith(
      { _id: "table-id", branchId: "branch-id" },
      undefined,
      { session },
    );
    expect(Table.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "table-id", branchId: "branch-id" },
      { status: "billing" },
      { new: true, runValidators: true, session },
    );
    expect(Table.findOneAndDelete).toHaveBeenCalledWith(
      { _id: "table-id", branchId: "branch-id" },
      { session },
    );
  });
});
