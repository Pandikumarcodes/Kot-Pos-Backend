const mongoose = require("mongoose");

const Billing = require("../models/billings");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const TakeAway = require("../models/takeAway");
const Inventory = require("../models/Inventory");
const Kot = require("../models/kot");
const StockLog = require("../models/StockLog");

const operationalModels = [
  ["Table", Table],
  ["TableOrder", TableOrder],
  ["TakeAway", TakeAway],
  ["Inventory", Inventory],
  ["KOT", Kot],
  ["StockLog", StockLog],
];

describe("Phase 5D ownership constraints", () => {
  test.each(operationalModels)("%s requires immutable branchId", (name, Model) => {
    const path = Model.schema.path("branchId");
    expect(path).toBeDefined();
    expect(path.options.required).toBe(true);
    expect(path.options.immutable).toBe(true);
    expect(path.options.index).toBe(true);
  });

  test("new Billing requires branchId while preserving historical hydration", async () => {
    const branchlessNewBill = new Billing({
      customerName: "Historical-like bill",
      billNumber: `phase5d-${new mongoose.Types.ObjectId()}`,
      items: [],
      totalAmount: 0,
      createdBy: new mongoose.Types.ObjectId(),
    });
    const newError = await branchlessNewBill.validate().catch((error) => error);
    expect(newError.errors.branchId).toBeDefined();
    expect(Billing.schema.path("branchId").options.immutable).toBe(true);
    expect(Billing.schema.path("branchId").options.index).toBe(true);

    const historical = Billing.hydrate({
      _id: new mongoose.Types.ObjectId(),
      customerName: "Historical bill",
      billNumber: `historical-${new mongoose.Types.ObjectId()}`,
      items: [],
      totalAmount: 0,
      paymentStatus: "paid",
      createdBy: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(historical.validate()).resolves.toBeUndefined();
  });

  test("branch-owned operational models reject new branchless documents", async () => {
    for (const [, Model] of operationalModels) {
      const error = await new Model({}).validate().catch((validationError) => validationError);
      expect(error.errors.branchId).toBeDefined();
    }
  });
});
