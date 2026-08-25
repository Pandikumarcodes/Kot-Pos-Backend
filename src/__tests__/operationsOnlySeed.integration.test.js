const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const User = require("../models/users");
const MenuItem = require("../models/menuItems");
const Customer = require("../models/customer");
const Inventory = require("../models/Inventory");
const StockLog = require("../models/StockLog");
const AuditEvent = require("../models/AuditEvent");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const TakeAway = require("../models/takeAway");
const Kot = require("../models/kot");
const Billing = require("../models/billings");
const { seed, operationsOnlySeed } = require("../seed");

const integrationUri = process.env.OPERATIONS_SEED_TEST_URI;
const isLocalReplica =
  typeof integrationUri === "string" &&
  /^mongodb(?:\+srv)?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(
    integrationUri,
  ) &&
  /\/Kot-Pos(?:\?|$)/.test(integrationUri);
const describeIntegration = isLocalReplica ? describe : describe.skip;

function ids(rows) {
  return rows.map((row) => String(row._id)).sort();
}

function logicalRows(rows) {
  return rows.map((row) => JSON.stringify(row)).sort();
}

async function snapshot() {
  const [branches, users, menu, customers, inventory, logs, auditCount, tables, orders, takeaways, kots, bills] =
    await Promise.all([
      Branch.find({}).lean(),
      User.find({}).lean(),
      MenuItem.find({}).lean(),
      Customer.find({}).lean(),
      Inventory.find({}).lean(),
      StockLog.find({}).lean(),
      AuditEvent.countDocuments({}),
      Table.find({}).lean(),
      TableOrder.find({}).lean(),
      TakeAway.find({}).lean(),
      Kot.find({}).lean(),
      Billing.find({}).lean(),
    ]);
  const branchNames = new Map(
    branches.map((row) => [String(row._id), row.name]),
  );
  const usernames = new Map(
    users.map((row) => [String(row._id), row.username]),
  );
  const tableKeys = new Map(
    tables.map((row) => [
      String(row._id),
      `${branchNames.get(String(row.branchId))}:${row.tableNumber}`,
    ]),
  );
  const itemRows = (items) =>
    items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      ...(item.total == null ? {} : { total: item.total }),
    }));
  const when = (value) => new Date(value).toISOString();
  return {
    foundationIds: {
      branches: ids(branches),
      users: ids(users),
      menu: ids(menu),
      customers: ids(customers),
      inventory: ids(inventory),
      logs: ids(logs),
    },
    inventory: inventory.map((row) => [String(row._id), row.currentStock]).sort(),
    logs: logs.map((row) => [String(row._id), String(row.kotId || ""), row.stockAfter]).sort(),
    auditCount,
    operationalIds: {
      tables: ids(tables),
      orders: ids(orders),
      takeaways: ids(takeaways),
      kots: ids(kots),
      bills: ids(bills),
    },
    logicalOperational: {
      tables: logicalRows(
        tables.map((row) => ({
          branch: branchNames.get(String(row.branchId)),
          tableNumber: row.tableNumber,
          capacity: row.capacity,
          status: row.status,
          currentCustomer: row.currentCustomer || null,
        })),
      ),
      orders: logicalRows(
        orders.map((row) => ({
          table: tableKeys.get(String(row.tableId)),
          customerName: row.customerName,
          items: itemRows(row.items),
          totalAmount: row.totalAmount,
          status: row.status,
          createdBy: usernames.get(String(row.createdBy)),
          createdAt: when(row.createdAt),
        })),
      ),
      takeaways: logicalRows(
        takeaways.map((row) => ({
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          items: itemRows(row.items),
          status: row.status,
          createdBy: usernames.get(String(row.createdBy)),
          createdAt: when(row.createdAt),
        })),
      ),
      kots: logicalRows(
        kots.map((row) => ({
          branch: branchNames.get(String(row.branchId)),
          orderType: row.orderType,
          table: row.tableId ? tableKeys.get(String(row.tableId)) : null,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          items: itemRows(row.items),
          totalAmount: row.totalAmount,
          status: row.status,
          createdBy: usernames.get(String(row.createdBy)),
          createdAt: when(row.createdAt),
        })),
      ),
      bills: logicalRows(
        bills.map((row) => ({
          billNumber: row.billNumber,
          table: row.tableId ? tableKeys.get(String(row.tableId)) : null,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          items: itemRows(row.items),
          totalAmount: row.totalAmount,
          paymentStatus: row.paymentStatus,
          paymentMethod: row.paymentMethod,
          paidAt: row.paidAt ? when(row.paidAt) : null,
          createdBy: usernames.get(String(row.createdBy)),
          createdAt: when(row.createdAt),
        })),
      ),
    },
    counts: [tables.length, orders.length, takeaways.length, kots.length, bills.length],
  };
}

describeIntegration("operations-only transaction on a disposable local replica set", () => {
  const previous = {
    mongoUri: process.env.MONGO_URI,
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.DEMO_SEED_ENABLED,
  };

  beforeAll(async () => {
    jest.setTimeout(180000);
    process.env.MONGO_URI = integrationUri;
    process.env.NODE_ENV = "development";
    process.env.DEMO_SEED_ENABLED = "true";
    await seed("clean");
    await mongoose.connect(integrationUri);
    await AuditEvent.collection.insertOne({
      eventId: `operations-seed-integration-preserved-${Date.now()}`,
      marker: "must survive operations-only",
    });
    await mongoose.disconnect();
  }, 180000);

  afterAll(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
    process.env.MONGO_URI = previous.mongoUri;
    process.env.NODE_ENV = previous.nodeEnv;
    process.env.DEMO_SEED_ENABLED = previous.enabled;
  });

  test("rolls back a forced failure after Bill insertion", async () => {
    await mongoose.connect(integrationUri);
    const before = await snapshot();
    await mongoose.disconnect();

    await expect(
      operationsOnlySeed({
        afterStage(stage) {
          if (stage === "bills") throw new Error("forced rollback probe");
        },
      }),
    ).rejects.toThrow("forced rollback probe");

    await mongoose.connect(integrationUri);
    const after = await snapshot();
    await mongoose.disconnect();
    expect(after).toEqual(before);
  }, 180000);

  test("guard and fingerprint failures leave operational data untouched", async () => {
    await mongoose.connect(integrationUri);
    const before = await snapshot();
    await mongoose.disconnect();

    process.env.DEMO_SEED_ENABLED = "false";
    await expect(operationsOnlySeed()).rejects.toThrow(/DEMO_SEED_ENABLED/);
    process.env.DEMO_SEED_ENABLED = "true";

    await mongoose.connect(integrationUri);
    const customer = await Customer.findOne({}).lean();
    await Customer.updateOne(
      { _id: customer._id },
      { $set: { name: "Foundation mismatch probe" } },
    );
    await mongoose.disconnect();
    await expect(operationsOnlySeed()).rejects.toThrow(/customer identity/);

    await mongoose.connect(integrationUri);
    await Customer.updateOne(
      { _id: customer._id },
      { $set: { name: customer.name } },
    );
    const after = await snapshot();
    await mongoose.disconnect();
    expect(after.operationalIds).toEqual(before.operationalIds);
    expect(after.counts).toEqual(before.counts);
  }, 180000);

  test("refuses a preserved StockLog reference to an existing KOT", async () => {
    await mongoose.connect(integrationUri);
    const before = await snapshot();
    const [log, kot] = await Promise.all([
      StockLog.findOne({}),
      Kot.findOne({}).select("_id").lean(),
    ]);
    await StockLog.collection.updateOne(
      { _id: log._id },
      { $set: { kotId: kot._id } },
    );
    await mongoose.disconnect();

    await expect(operationsOnlySeed()).rejects.toThrow(
      "Operational reseed refused because runtime stock history references existing KOT records.",
    );

    await mongoose.connect(integrationUri);
    await StockLog.collection.updateOne(
      { _id: log._id },
      { $set: { kotId: null } },
    );
    const after = await snapshot();
    await mongoose.disconnect();
    expect(after.operationalIds).toEqual(before.operationalIds);
    expect(after.counts).toEqual(before.counts);
  }, 180000);

  test("preserves foundation and append-only audit data across successful reruns", async () => {
    await mongoose.connect(integrationUri);
    const before = await snapshot();
    await mongoose.disconnect();
    await operationsOnlySeed();
    await operationsOnlySeed();
    await mongoose.connect(integrationUri);
    const after = await snapshot();
    await mongoose.disconnect();

    expect(after.counts).toEqual([36, 116, 42, 143, 133]);
    expect(after.foundationIds).toEqual(before.foundationIds);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.logs).toEqual(before.logs);
    expect(after.auditCount).toBe(before.auditCount);
    expect(after.operationalIds).not.toEqual(before.operationalIds);
    expect(after.logicalOperational).toEqual(before.logicalOperational);
  }, 180000);
});
