const mongoose = require("mongoose");
const {
  DEMO_BRANCHES,
  MENU_ITEMS,
  CUSTOMER_FIXTURE,
  buildDemoUsers,
  buildDemoTables,
  buildInventory,
  buildHistoricalStories,
  createOperationalStories,
  buildStockLogs,
  calculateCustomerMetrics,
  getSeedMode,
  assertDisposableDemoTarget,
  assertOperationsOnlyTarget,
  assertFoundationFingerprint,
  assertNoRuntimeOperationalReferences,
} = require("../seed");

function demoFoundation() {
  const branches = DEMO_BRANCHES.map((definition) => ({
    _id: new mongoose.Types.ObjectId(),
    definition,
  }));
  const users = buildDemoUsers(branches).map((user) => ({
    ...user,
    _id: new mongoose.Types.ObjectId(),
  }));
  const branchDocs = branches.map((branch) => ({
    _id: branch._id,
    ...branch.definition,
    isActive: true,
    adminUser: users.find(
      (user) => user.username === branch.definition.username,
    )._id,
  }));
  const menu = MENU_ITEMS.map((item) => ({
    ...item,
    _id: new mongoose.Types.ObjectId(),
  }));
  const customers = CUSTOMER_FIXTURE.map((customer) => ({
    ...customer,
    _id: new mongoose.Types.ObjectId(),
  }));
  const inventory = buildInventory(branches).map((item) => ({
    ...item,
    _id: new mongoose.Types.ObjectId(),
  }));
  const logs = buildStockLogs(inventory, users).map((log) => ({
    ...log,
    _id: new mongoose.Types.ObjectId(),
    kotId: null,
  }));
  const settingsDefaults = {
    currency: "INR",
    timezone: "Asia/Kolkata",
    openTime: "09:00",
    closeTime: "23:00",
    avgServiceTime: 45,
    maxCapacity: 100,
    takeawayEnabled: true,
    deliveryEnabled: false,
    taxRate: 5,
    fssai: "",
    hsn: "996331",
    serviceCharge: 0,
    autoRoundOff: true,
    printReceipt: true,
    orderAlerts: true,
    lowStockAlerts: true,
    emailNotifications: false,
    paymentMethods: { cash: true, card: true, upi: true },
  };
  const settings = [
    {
      ...settingsDefaults,
      _id: new mongoose.Types.ObjectId(),
      branchId: null,
      businessName: "KOT POS Demo",
      address: "Bengaluru, Karnataka",
    },
    ...branches.map((branch) => ({
      ...settingsDefaults,
      _id: new mongoose.Types.ObjectId(),
      branchId: branch._id,
      businessName: branch.definition.name,
      address: branch.definition.address,
      phone: branch.definition.phone,
      email: branch.definition.email,
      gstin: branch.definition.gstin,
    })),
  ];
  return {
    branches,
    branchDocs,
    users,
    menu,
    customers,
    inventory,
    logs,
    settings,
    kots: [{ _id: new mongoose.Types.ObjectId() }],
  };
}

async function operationalFixture(foundation) {
  const tables = buildDemoTables(foundation.branches).map((table) => ({
    ...table,
    _id: new mongoose.Types.ObjectId(),
  }));
  const history = buildHistoricalStories(
    foundation.branches,
    tables,
    foundation.users,
    foundation.menu,
    foundation.customers,
  );
  const current = await createOperationalStories(
    foundation.branches,
    tables,
    foundation.users,
    foundation.menu,
    foundation.customers,
  );
  return {
    tables,
    orders: [...history.tableOrders, ...current.tableOrders],
    takeaways: [...history.takeaways, ...current.takeaways],
    kots: [...history.kots, ...current.kots],
    bills: [...history.bills, ...current.bills],
  };
}

function distribution(rows, field) {
  return rows.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] || 0) + 1;
    return counts;
  }, {});
}

describe("operations-only demo reseed", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnabled = process.env.DEMO_SEED_ENABLED;
  const originalDatabase = mongoose.connection.db;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEMO_SEED_ENABLED = originalEnabled;
    mongoose.connection.db = originalDatabase;
  });

  test("strictly recognizes only the allowlisted seed modes", () => {
    expect(getSeedMode(["node", "src/seed.js"])).toBe("full");
    expect(getSeedMode(["node", "src/seed.js", "full"])).toBe("full");
    expect(getSeedMode(["node", "src/seed.js", "--operations-only"])).toBe(
      "operations-only",
    );
    for (const flag of ["--foo", "--operation-only", "--reset", "--production"])
      expect(() => getSeedMode(["node", "src/seed.js", flag])).toThrow(
        /Unknown seed argument/,
      );
    for (const flags of [
      ["--clean", "--customers-only"],
      ["--clean", "--operations-only"],
      ["--customers-only", "--operations-only"],
    ])
      expect(() => getSeedMode(["node", "src/seed.js", ...flags])).toThrow(
        /mutually exclusive/,
      );
  });

  test("requires development, Kot-Pos, and an explicit demo opt-in", () => {
    mongoose.connection.db = { databaseName: "Kot-Pos" };
    process.env.NODE_ENV = "test";
    process.env.DEMO_SEED_ENABLED = "true";
    expect(() => assertDisposableDemoTarget()).toThrow(/development\/Kot-Pos/);
    process.env.NODE_ENV = "development";
    mongoose.connection.db = { databaseName: "another-database" };
    expect(() => assertOperationsOnlyTarget()).toThrow(/development\/Kot-Pos/);
    mongoose.connection.db = { databaseName: "Kot-Pos" };
    process.env.DEMO_SEED_ENABLED = "false";
    expect(() => assertOperationsOnlyTarget()).toThrow(/DEMO_SEED_ENABLED/);
    process.env.DEMO_SEED_ENABLED = "true";
    expect(() => assertOperationsOnlyTarget()).not.toThrow();
  });

  test("accepts only the exact deterministic foundation fingerprint", () => {
    const foundation = demoFoundation();
    const context = assertFoundationFingerprint(foundation);
    expect(context.branches).toHaveLength(3);
    expect(context.users).toHaveLength(25);
    foundation.customers[0].name = "Runtime Customer";
    expect(() => assertFoundationFingerprint(foundation)).toThrow(
      /customer identity/,
    );
  });

  test("rejects a modified deterministic StockLog baseline", () => {
    const foundation = demoFoundation();
    foundation.logs[0].quantity += 1;
    foundation.logs[0].stockAfter += 1;
    expect(() => assertFoundationFingerprint(foundation)).toThrow(
      /StockLogs are not the exact deterministic demo baseline/,
    );
  });

  test("refuses a StockLog ObjectId reference to a KOT being deleted", () => {
    const foundation = demoFoundation();
    foundation.logs[0].kotId = foundation.kots[0]._id;
    expect(() =>
      assertNoRuntimeOperationalReferences(foundation.logs, foundation.kots),
    ).toThrow(
      "Operational reseed refused because runtime stock history references existing KOT records.",
    );
  });

  test("shared generators produce the exact operational counts and distributions", async () => {
    const foundation = demoFoundation();
    const fixture = await operationalFixture(foundation);
    expect([
      fixture.tables.length,
      fixture.orders.length,
      fixture.takeaways.length,
      fixture.kots.length,
      fixture.bills.length,
    ]).toEqual([36, 116, 42, 143, 133]);
    expect(distribution(fixture.tables, "status")).toEqual({
      reserved: 4,
      occupied: 9,
      billing: 5,
      available: 18,
    });
    expect(distribution(fixture.kots, "status")).toEqual({
      served: 133,
      pending: 4,
      preparing: 3,
      ready: 3,
    });
    expect(distribution(fixture.bills, "paymentMethod")).toEqual({
      upi: 52,
      card: 39,
      cash: 37,
      none: 5,
    });
    const branchIndex = new Map(
      foundation.branches.map((branch, index) => [String(branch._id), index]),
    );
    const users = new Map(
      foundation.users.map((user) => [String(user._id), user]),
    );
    const tables = new Map(
      fixture.tables.map((table) => [String(table._id), table]),
    );
    const byCreatorBranch = (rows) =>
      rows.reduce((counts, row) => {
        const user = users.get(String(row.createdBy));
        const key = branchIndex.get(String(user.branchId));
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});
    const byTableBranch = fixture.orders.reduce((counts, order) => {
      const table = tables.get(String(order.tableId));
      const key = branchIndex.get(String(table.branchId));
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    expect(byTableBranch).toEqual({ 0: 58, 1: 35, 2: 23 });
    expect(byCreatorBranch(fixture.takeaways)).toEqual({ 0: 23, 1: 11, 2: 8 });
    expect(byCreatorBranch(fixture.bills)).toEqual({ 0: 66, 1: 40, 2: 27 });
    expect(
      fixture.kots.reduce((counts, kot) => {
        const key = branchIndex.get(String(kot.branchId));
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ 0: 71, 1: 43, 2: 29 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const paid = fixture.bills.filter((bill) => bill.paymentStatus === "paid");
    expect(paid.filter((bill) => bill.createdAt >= today)).toHaveLength(8);
    expect(paid.filter((bill) => bill.createdAt < today)).toHaveLength(120);
    expect(new Set(fixture.bills.map((bill) => bill.billNumber)).size).toBe(133);
    expect(
      new Set(
        fixture.tables.map((table) => `${table.branchId}:${table.tableNumber}`),
      ).size,
    ).toBe(36);
  });

  test("recomputes customer activity with phone plus exact timestamp deduplication", async () => {
    const foundation = demoFoundation();
    const fixture = await operationalFixture(foundation);
    const metrics = calculateCustomerMetrics(
      foundation.customers,
      fixture.bills,
      fixture.orders,
      fixture.takeaways,
    );
    expect(metrics.size).toBe(120);
    expect([...metrics.values()].reduce((sum, row) => sum + row.totalSpent, 0)).toBe(
      fixture.bills
        .filter((bill) => bill.paymentStatus === "paid")
        .reduce((sum, bill) => sum + bill.totalAmount, 0),
    );
    expect([...metrics.values()].every((row) => row.totalOrders >= 0)).toBe(true);
  });
});
