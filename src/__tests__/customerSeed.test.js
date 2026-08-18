const mongoose = require("mongoose");
const Customer = require("../models/customer");
const User = require("../models/users");
const Branch = require("../models/Branch");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const Kot = require("../models/kot");
const Billing = require("../models/billings");
const Inventory = require("../models/Inventory");
const Settings = require("../models/settings");
const {
  CUSTOMER_FIXTURE,
  reseedCustomersOnly,
  assertDisposableDemoTarget,
  getSeedMode,
} = require("../seed");

const query = (rows) => ({
  lean: () => ({ session: async () => rows }),
});

describe("customer-only demo seed", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    mongoose.connection.db = { databaseName: "Kot-Pos" };
    jest.spyOn(Billing, "find").mockReturnValue(query([]));
    jest.spyOn(Kot, "find").mockReturnValue(query([]));
    jest.spyOn(TableOrder, "find").mockReturnValue(query([]));
    jest.spyOn(require("../models/takeAway"), "find").mockReturnValue(query([]));
    jest.spyOn(Customer, "deleteMany").mockResolvedValue({ deletedCount: 120 });
    jest.spyOn(Customer, "insertMany").mockResolvedValue(CUSTOMER_FIXTURE);
    jest.spyOn(Customer, "updateOne").mockResolvedValue({});
    jest.spyOn(Customer, "countDocuments").mockReturnValue({
      session: async () => 120,
    });
    jest.spyOn(Customer, "distinct").mockResolvedValue(CUSTOMER_FIXTURE.map((customer) => customer.phone));
    for (const model of [User, Branch, Table, TableOrder, Kot, Billing, Inventory, Settings])
      jest.spyOn(model, "deleteMany").mockResolvedValue({ deletedCount: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("creates 120 unique customers and deletes only Customer", async () => {
    await reseedCustomersOnly({});

    expect(Customer.deleteMany).toHaveBeenCalledWith({}, { session: {} });
    expect(Customer.insertMany).toHaveBeenCalledWith(CUSTOMER_FIXTURE, {
      session: {},
      ordered: true,
    });
    expect(CUSTOMER_FIXTURE).toHaveLength(120);
    expect(new Set(CUSTOMER_FIXTURE.map((customer) => customer.phone)).size).toBe(120);
    await expect(
      Promise.all(CUSTOMER_FIXTURE.map((customer) => new Customer(customer).validate())),
    ).resolves.toHaveLength(120);
    for (const model of [User, Branch, Table, TableOrder, Kot, Billing, Inventory, Settings])
      expect(model.deleteMany).not.toHaveBeenCalled();
  });

  test("rejects an invalid environment before touching Customer", async () => {
    process.env.NODE_ENV = "test";
    expect(() => assertDisposableDemoTarget()).toThrow(/development\/Kot-Pos/);
    expect(Customer.deleteMany).not.toHaveBeenCalled();
  });

  test("rejects snapshot identity conflicts before deleting Customer", async () => {
    TableOrder.find.mockReturnValue(query([{ customerName: "Different Name" }]));
    await expect(reseedCustomersOnly({})).rejects.toThrow(/snapshots do not match/);
    expect(Customer.deleteMany).not.toHaveBeenCalled();
  });

  test("leaves normal full and clean seed mode selection unchanged", () => {
    expect(getSeedMode(["node", "src/seed.js"])).toBe("full");
    expect(getSeedMode(["node", "src/seed.js", "--clean"])).toBe("clean");
    expect(getSeedMode(["node", "src/seed.js", "--customers-only"])).toBe("customers-only");
    expect(() => getSeedMode(["--clean", "--customers-only"])).toThrow(/either/);
  });
});
