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

const Inventory = require("../../models/Inventory");
const Billing = require("../../models/billings");
const InventoryRepository = require("../../repositories/InventoryRepository");
const ReportRepository = require("../../repositories/ReportRepository");

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
});
