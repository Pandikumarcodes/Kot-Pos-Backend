const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("./models/users");
const Branch = require("./models/Branch");
const Table = require("./models/tables");
const MenuItem = require("./models/menuItems");
const Settings = require("./models/settings");
const Inventory = require("./models/Inventory");
const Customer = require("./models/customer");
const Kot = require("./models/kot");
const Billing = require("./models/billings");
const StockLog = require("./models/StockLog");
const TableOrder = require("./models/waiter");
const TakeAway = require("./models/takeAway");
const AuditEvent = require("./models/AuditEvent");
const { ensureIndexes, listTableIndexes } = require("./models/indexes");
const { buildMenuItems, MENU_DISTRIBUTION } = require("./seedData/menuItems");
const { buildCustomers } = require("./seedData/customers");
const { buildInventory, BRANCH_COUNTS } = require("./seedData/inventory");

function getSeedMode(argv = process.argv) {
  const supported = new Map([
    ["full", "full"],
    ["--clean", "clean"],
    ["--customers-only", "customers-only"],
    ["--operations-only", "operations-only"],
  ]);
  const scriptIndex = argv.findIndex((argument) =>
    /(?:^|[\\/])seed\.js$/i.test(argument),
  );
  const args = scriptIndex >= 0 ? argv.slice(scriptIndex + 1) : argv;
  const unknown = args.filter((argument) => !supported.has(argument));
  if (unknown.length)
    throw new Error(`Unknown seed argument(s): ${unknown.join(", ")}`);
  const modes = [...new Set(args.map((argument) => supported.get(argument)))];
  if (modes.length > 1)
    throw new Error(
      `Use either one seed mode; modes are mutually exclusive: ${args.join(" ")}`,
    );
  if (args.length > 1)
    throw new Error(`Seed mode may be specified only once: ${args.join(" ")}`);
  return modes[0] || "full";
}
const DEMO_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Demo@12345";
const DAY = 24 * 60 * 60 * 1000;
const DEMO_BRANCHES = [
  {
    key: "indiranagar",
    name: "Indiranagar Flagship",
    username: "admin.indiranagar",
    address: "100 Feet Road, Indiranagar, Bengaluru, Karnataka",
    phone: "08040010001",
    email: "indiranagar@kotpos.demo",
    gstin: "29AABCK1001F1Z5",
    tableCount: 14,
    staff: { manager: 1, waiter: 3, chef: 2, cashier: 2 },
  },
  {
    key: "whitefield",
    name: "Whitefield Tech Park",
    username: "admin.whitefield",
    address: "ITPL Main Road, Whitefield, Bengaluru, Karnataka",
    phone: "08040010002",
    email: "whitefield@kotpos.demo",
    gstin: "29AABCK1002F1Z5",
    tableCount: 12,
    staff: { manager: 1, waiter: 3, chef: 2, cashier: 1 },
  },
  {
    key: "jayanagar",
    name: "Jayanagar Family Dining",
    username: "admin.jayanagar",
    address: "4th Block, Jayanagar, Bengaluru, Karnataka",
    phone: "08040010003",
    email: "jayanagar@kotpos.demo",
    gstin: "29AABCK1003F1Z5",
    tableCount: 10,
    staff: { manager: 1, waiter: 2, chef: 2, cashier: 1 },
  },
];
const MENU_ITEMS = buildMenuItems();
const CUSTOMER_FIXTURE = buildCustomers();
const INVENTORY_FIXTURE = [];

function assertDisposableDemoTarget(operation = "destructive seed") {
  const databaseName = mongoose.connection.db?.databaseName;
  if (process.env.NODE_ENV !== "development" || databaseName !== "Kot-Pos")
    throw new Error(
      `Refusing ${operation}: expected development/Kot-Pos, got ${process.env.NODE_ENV || "unset"}/${databaseName || "unknown"}`,
    );
}

function assertOperationsOnlyTarget() {
  assertDisposableDemoTarget("operations-only seed");
  if (process.env.DEMO_SEED_ENABLED !== "true")
    throw new Error(
      "Refusing operations-only seed: DEMO_SEED_ENABLED must be exactly true",
    );
}
function buildDemoUsers(branches) {
  const users = [
    { username: "superadmin", role: "superadmin", branchId: null },
  ];
  for (const branch of branches) {
    users.push({
      username: branch.definition.username,
      role: "admin",
      branchId: branch._id,
    });
    for (const [role, count] of Object.entries(branch.definition.staff))
      for (let index = 1; index <= count; index += 1)
        users.push({
          username: `${role}.${branch.definition.key}.${index}`,
          role,
          branchId: branch._id,
        });
  }
  return users.map((user) => ({
    ...user,
    password: DEMO_PASSWORD,
    status: "active",
  }));
}
function buildDemoTables(branches) {
  return branches.flatMap(({ _id, definition }) =>
    Array.from({ length: definition.tableCount }, (_, index) => ({
      branchId: _id,
      tableNumber: index + 1,
      capacity: index % 4 === 0 ? 2 : index % 3 === 0 ? 6 : 4,
      status: "available",
    })),
  );
}
function branchDocument(definition) {
  return {
    name: definition.name,
    address: definition.address,
    phone: definition.phone,
    email: definition.email,
    gstin: definition.gstin,
    isActive: false,
    adminUser: null,
  };
}
function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
function atDay(dayOffset, hour, minute) {
  const date = new Date(startOfToday().getTime() - dayOffset * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}
function pick(list, index) {
  return list[index % list.length];
}
function chooseItems(menu, index, family = false) {
  const popular = [
    "Chicken Biryani",
    "Paneer Tikka",
    "Butter Naan",
    "Masala Dosa",
    "Veg Fried Rice",
    "Fresh Lime Soda",
    "Paneer Butter Masala",
    "Garlic Bread",
  ];
  const available = menu.filter((item) => item.available);
  const first = available.find(
    (item) => item.ItemName === pick(popular, index),
  );
  const second = available[(index * 7 + (family ? 11 : 3)) % available.length];
  const rows = [
    {
      itemId: first._id,
      name: first.ItemName,
      quantity: family ? 2 : 1,
      price: first.price,
    },
  ];
  if (second._id.toString() !== first._id.toString())
    rows.push({
      itemId: second._id,
      name: second.ItemName,
      quantity: 1,
      price: second.price,
    });
  return rows;
}
function total(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
function actorFor(users, branch, role, index = 0) {
  return (
    users.find(
      (user) =>
        String(user.branchId) === String(branch._id) &&
        user.role === role &&
        user.username.endsWith(`.${index + 1}`),
    ) ||
    users.find(
      (user) =>
        String(user.branchId) === String(branch._id) && user.role === role,
    )
  );
}
function billItems(items) {
  return items.map((item) => ({ ...item, total: item.price * item.quantity }));
}

async function cleanDatabase() {
  assertDisposableDemoTarget();
  await Promise.all([
    User.deleteMany({}),
    Branch.deleteMany({}),
    Table.deleteMany({}),
    Settings.deleteMany({}),
    MenuItem.deleteMany({}),
    Inventory.deleteMany({}),
    Customer.deleteMany({}),
    StockLog.deleteMany({}),
    Kot.deleteMany({}),
    Billing.deleteMany({}),
    TableOrder.deleteMany({}),
    TakeAway.deleteMany({}),
  ]);
}

function snapshotIdentity(row) {
  if (!row.customerName) return null;
  return `${row.customerName}\u0000${row.customerPhone || ""}`;
}

function assertCustomerSnapshotsMatchFixture(rows) {
  const fixtureByName = new Map(CUSTOMER_FIXTURE.map((customer) => [customer.name, customer]));
  const mismatches = rows
    .map(snapshotIdentity)
    .filter(Boolean)
    .filter((identity) => {
      const [name, phone] = identity.split("\u0000");
      const customer = fixtureByName.get(name);
      return !customer || (phone && customer.phone !== phone);
    });
  if (mismatches.length)
    throw new Error(
      `Refusing customer-only seed: existing transaction snapshots do not match the deterministic customer fixture (${mismatches.length} mismatch(es))`,
    );
}

async function reseedCustomersOnly(session) {
  assertDisposableDemoTarget();
  const [bills, kots, orders, takeaways] = await Promise.all([
    Billing.find({}).lean().session(session),
    Kot.find({}).lean().session(session),
    TableOrder.find({}).lean().session(session),
    TakeAway.find({}).lean().session(session),
  ]);
  assertCustomerSnapshotsMatchFixture([
    ...bills,
    ...kots,
    ...orders,
    ...takeaways,
  ]);

  await Customer.deleteMany({}, { session });
  const customers = await Customer.insertMany(CUSTOMER_FIXTURE, {
    session,
    ordered: true,
  });
  await updateCustomerMetrics(customers, bills, orders, takeaways, session);
  const count = await Customer.countDocuments({}).session(session);
  const phones = await Customer.distinct("phone", {}, { session });
  if (count !== 120 || phones.length !== 120)
    throw new Error("Customer-only seed verification failed");
  return { count, phones: phones.length };
}

function buildHistoricalStories(branches, tables, users, menu, customers) {
  const tableOrders = [],
    takeaways = [],
    kots = [],
    bills = [],
    customerStats = new Map(
      customers.map((customer) => [
        String(customer._id),
        { totalOrders: 0, totalSpent: 0, lastVisit: null },
      ]),
    );
  const paymentMethods = [
    "upi",
    "upi",
    "upi",
    "upi",
    "card",
    "card",
    "card",
    "cash",
    "cash",
    "cash",
  ];
  for (let i = 0; i < 135; i += 1) {
    const branchIndex = i % 10 < 5 ? 0 : i % 10 < 8 ? 1 : 2;
    const branch = branches[branchIndex];
    const branchTables = tables.filter(
      (table) => String(table.branchId) === String(branch._id),
    );
    const isTakeaway = i < 33;
    const cancelled = i >= 120;
    const dayOffset = 1 + ((i * 7) % 119);
    const weekend = [0, 5, 6].includes(
      new Date(startOfToday().getTime() - dayOffset * DAY).getDay(),
    );
    const createdAt = atDay(
      dayOffset,
      weekend ? 20 : i % 3 === 0 ? 13 : 20,
      i % 2 ? 15 : 45,
    );
    const customer = customers[i % customers.length];
    const items = chooseItems(menu, i, branchIndex === 2 && weekend);
    const createdBy = actorFor(
      users,
      branch,
      isTakeaway ? "cashier" : "waiter",
      i % 2,
    );
    const snapshot = { name: customer.name, phone: customer.phone };
    if (isTakeaway) {
      const order = {
        customerName: snapshot.name,
        customerPhone: snapshot.phone,
        items,
        status: cancelled ? "cancelled" : "received",
        createdBy: createdBy._id,
        createdAt,
        updatedAt: createdAt,
      };
      takeaways.push(order);
      if (!cancelled)
        kots.push({
          branchId: branch._id,
          orderType: "takeaway",
          customerName: snapshot.name,
          customerPhone: snapshot.phone,
          items,
          totalAmount: total(items),
          status: "served",
          createdBy: createdBy._id,
          createdAt,
          updatedAt: createdAt,
        });
      if (!cancelled)
        bills.push({
          customerName: snapshot.name,
          customerPhone: snapshot.phone,
          billNumber: `DEMO-${String(i + 1).padStart(4, "0")}`,
          tableId: null,
          tableNumber: null,
          items: billItems(items),
          totalAmount: total(items),
          paymentStatus: "paid",
          paymentMethod: pick(paymentMethods, i),
          paidAt: new Date(createdAt.getTime() + 35 * 60000),
          createdBy: actorFor(users, branch, "cashier", i % 2)._id,
          createdAt,
          updatedAt: createdAt,
        });
    } else {
      const table = branchTables[i % branchTables.length];
      const order = {
        tableNumber: table.tableNumber,
        customerName: snapshot.name,
        tableId: table._id,
        items,
        totalAmount: total(items),
        status: cancelled ? "cancelled" : "served",
        createdBy: createdBy._id,
        createdAt,
        updatedAt: createdAt,
      };
      tableOrders.push(order);
      if (!cancelled)
        kots.push({
          branchId: branch._id,
          orderType: "dine-in",
          tableNumber: table.tableNumber,
          tableId: table._id,
          customerName: snapshot.name,
          customerPhone: snapshot.phone,
          items,
          totalAmount: total(items),
          status: "served",
          createdBy: createdBy._id,
          createdAt,
          updatedAt: createdAt,
        });
      if (!cancelled)
        bills.push({
          customerName: snapshot.name,
          customerPhone: snapshot.phone,
          billNumber: `DEMO-${String(i + 1).padStart(4, "0")}`,
          tableId: table._id,
          tableNumber: table.tableNumber,
          items: billItems(items),
          totalAmount: total(items),
          paymentStatus: "paid",
          paymentMethod: pick(paymentMethods, i),
          paidAt: new Date(createdAt.getTime() + 35 * 60000),
          createdBy: actorFor(users, branch, "cashier", i % 2)._id,
          createdAt,
          updatedAt: createdAt,
        });
    }
  }
  return { tableOrders, takeaways, kots, bills, customerStats };
}

async function createOperationalStories(
  branches,
  tables,
  users,
  menu,
  customers,
) {
  const tableOrders = [],
    takeaways = [],
    kots = [],
    bills = [];
  tables.slice(0, 4).forEach((table) => {
    table.status = "reserved";
    table.currentCustomer = null;
  });
  const occupied = branches.flatMap((branch, branchIndex) =>
    tables
      .filter(
        (table) =>
          String(table.branchId) === String(branch._id) &&
          table.status === "available",
      )
      .slice(0, [4, 3, 2][branchIndex]),
  );
  const billingTables = branches.flatMap((branch, branchIndex) =>
    tables
      .filter(
        (table) =>
          String(table.branchId) === String(branch._id) &&
          table.status === "available",
      )
      .slice(
        [4, 3, 2][branchIndex],
        [4, 3, 2][branchIndex] + [2, 2, 1][branchIndex],
      ),
  );
  const queueStatuses = [
    "pending",
    "pending",
    "pending",
    "pending",
    "preparing",
    "preparing",
    "preparing",
    "ready",
    "ready",
    "ready",
  ];
  const make = (table, index, status, billing) => {
    const branch = branches.find(
      (candidate) => String(candidate._id) === String(table.branchId),
    );
    const waiter = actorFor(users, branch, "waiter", index);
    const customer = customers[(index + 40) % customers.length];
    const items = chooseItems(
      menu,
      index + 20,
      branch.definition.key === "jayanagar",
    );
    const createdAt = atDay(0, index % 2 ? 20 : 13, (index * 7) % 60);
    const order = {
      tableNumber: table.tableNumber,
      customerName: customer.name,
      tableId: table._id,
      items,
      totalAmount: total(items),
      status: billing ? "served" : "sent_to_kitchen",
      createdBy: waiter._id,
      createdAt,
      updatedAt: createdAt,
    };
    tableOrders.push(order);
    kots.push({
      branchId: branch._id,
      orderType: "dine-in",
      tableNumber: table.tableNumber,
      tableId: table._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      items,
      totalAmount: total(items),
      status: billing ? "served" : status,
      createdBy: waiter._id,
      createdAt,
      updatedAt: createdAt,
    });
    if (billing)
      bills.push({
        customerName: customer.name,
        customerPhone: customer.phone,
        billNumber: `DEMO-CURRENT-${index + 1}`,
        tableId: table._id,
        tableNumber: table.tableNumber,
        items: billItems(items),
        totalAmount: total(items),
        paymentStatus: "unpaid",
        paymentMethod: "none",
        paidAt: null,
        createdBy: actorFor(users, branch, "cashier", index)._id,
        createdAt,
        updatedAt: createdAt,
      });
    table.status = billing ? "billing" : "occupied";
    table.currentCustomer = { name: customer.name, phone: customer.phone };
  };
  occupied.forEach((table, index) =>
    make(table, index, queueStatuses[index], false),
  );
  billingTables.forEach((table, index) =>
    make(table, index + 9, "served", true),
  );
  const todayMix = ["upi", "upi", "upi", "upi", "card", "card", "card", "cash"];
  for (let i = 0; i < 8; i += 1) {
    const branch = branches[i < 4 ? 0 : i < 6 ? 1 : 2];
    const cashier = actorFor(users, branch, "cashier", i);
    const customer = customers[(i + 70) % customers.length];
    const items = chooseItems(menu, i + 50);
    const createdAt = atDay(0, 12 + (i % 2) * 8, 10 + i);
    takeaways.push({
      customerName: customer.name,
      customerPhone: customer.phone,
      items,
      status: "received",
      createdBy: cashier._id,
      createdAt,
      updatedAt: createdAt,
    });
    kots.push({
      branchId: branch._id,
      orderType: "takeaway",
      customerName: customer.name,
      customerPhone: customer.phone,
      items,
      totalAmount: total(items),
      status: "served",
      createdBy: cashier._id,
      createdAt,
      updatedAt: createdAt,
    });
    bills.push({
      customerName: customer.name,
      customerPhone: customer.phone,
      billNumber: `DEMO-TODAY-${i + 1}`,
      tableId: null,
      tableNumber: null,
      items: billItems(items),
      totalAmount: total(items),
      paymentStatus: "paid",
      paymentMethod: todayMix[i],
      paidAt: new Date(createdAt.getTime() + 30 * 60000),
      createdBy: cashier._id,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const currentTakeawayCustomer = customers[95];
  const currentTakeawayItems = chooseItems(menu, 95);
  const currentTakeawayAt = atDay(0, 19, 35);
  const currentTakeawayActor = actorFor(users, branches[0], "cashier", 0);
  takeaways.push({
    customerName: currentTakeawayCustomer.name,
    customerPhone: currentTakeawayCustomer.phone,
    items: currentTakeawayItems,
    status: "received",
    createdBy: currentTakeawayActor._id,
    createdAt: currentTakeawayAt,
    updatedAt: currentTakeawayAt,
  });
  kots.push({
    branchId: branches[0]._id,
    orderType: "takeaway",
    customerName: currentTakeawayCustomer.name,
    customerPhone: currentTakeawayCustomer.phone,
    items: currentTakeawayItems,
    totalAmount: total(currentTakeawayItems),
    status: "ready",
    createdBy: currentTakeawayActor._id,
    createdAt: currentTakeawayAt,
    updatedAt: currentTakeawayAt,
  });
  return { tableOrders, takeaways, kots, bills };
}

function buildStockLogs(inventory, users) {
  const logs = [];
  inventory.forEach((item, index) => {
    const actor = users.find(
      (user) =>
        String(user.branchId) === String(item.branchId) &&
        ["admin", "manager"].includes(user.role),
    );
    const before = item.currentStock + (index % 2 ? 6 : -4);
    const firstAfter = item.currentStock + (index % 2 ? 2 : 3);
    logs.push({
      branchId: item.branchId,
      inventoryId: item._id,
      type: "restock",
      quantity: firstAfter - before,
      stockBefore: before,
      stockAfter: firstAfter,
      note: "Scheduled demo replenishment",
      doneBy: actor._id,
      createdAt: atDay(60 + (index % 30), 10, 0),
      updatedAt: atDay(60 + (index % 30), 10, 0),
    });
    logs.push({
      branchId: item.branchId,
      inventoryId: item._id,
      type: index % 3 === 0 ? "adjustment" : "kot_deduct",
      quantity: item.currentStock - firstAfter,
      stockBefore: firstAfter,
      stockAfter: item.currentStock,
      note: "Coherent demo movement",
      doneBy: actor._id,
      createdAt: atDay(15 + (index % 15), 18, 0),
      updatedAt: atDay(15 + (index % 15), 18, 0),
    });
  });
  return logs;
}

async function updateCustomerMetrics(
  customers,
  bills,
  tableOrders,
  takeaways,
  session,
) {
  const metrics = calculateCustomerMetrics(
    customers,
    bills,
    tableOrders,
    takeaways,
  );
  await Promise.all(
    customers.map((customer) =>
      Customer.updateOne(
        { _id: customer._id },
        { $set: metrics.get(customer.phone) },
        { session },
      ),
    ),
  );
  return metrics;
}

function calculateCustomerMetrics(customers, bills, tableOrders, takeaways) {
  const metrics = new Map(
    customers.map((customer) => [
      customer.phone,
      { totalOrders: 0, totalSpent: 0, lastVisit: null },
    ]),
  );
  const seen = new Set();
  [
    ...bills,
    ...tableOrders.filter((order) => order.status !== "cancelled"),
    ...takeaways.filter((order) => order.status !== "cancelled"),
  ].forEach((row) => {
    const phone =
      row.customerPhone ||
      customers.find((customer) => customer.name === row.customerName)?.phone;
    const metric = metrics.get(phone);
    if (!metric) return;
    const key = `${phone}:${new Date(row.createdAt).getTime()}`;
    if (seen.has(key)) return;
    seen.add(key);
    metric.totalOrders += 1;
    if (row.paymentStatus === "paid") metric.totalSpent += row.totalAmount;
    const when = new Date(row.createdAt);
    if (!metric.lastVisit || when > metric.lastVisit) metric.lastVisit = when;
  });
  return metrics;
}

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function assertExactFields(actual, expected, label) {
  for (const [field, value] of Object.entries(expected)) {
    const equal =
      field.endsWith("Id") || field === "adminUser"
        ? sameId(actual[field], value)
        : actual[field] === value;
    if (!equal)
      throw new Error(
        `Foundation fingerprint mismatch: ${label}.${field} is not the deterministic demo value`,
      );
  }
}

function assertSettingsDefaults(settings, label) {
  assertExactFields(
    settings,
    {
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
    },
    label,
  );
  if (
    settings.paymentMethods?.cash !== true ||
    settings.paymentMethods?.card !== true ||
    settings.paymentMethods?.upi !== true
  )
    throw new Error(
      `Foundation fingerprint mismatch: ${label}.paymentMethods is not the deterministic demo value`,
    );
}

function assertFoundationFingerprint(foundation) {
  const { branchDocs, users, menu, customers, inventory, settings, logs } =
    foundation;
  if (
    branchDocs.length !== 3 ||
    users.length !== 25 ||
    menu.length !== 80 ||
    customers.length !== 120 ||
    inventory.length !== 45 ||
    settings.length !== 4 ||
    logs.length !== 90
  )
    throw new Error(
      "Foundation fingerprint mismatch: expected 3 branches, 25 users, 80 menu items, 120 customers, 45 inventory items, 4 settings rows, and 90 baseline stock logs",
    );

  const branches = DEMO_BRANCHES.map((definition) => {
    const matches = branchDocs.filter((branch) => branch.name === definition.name);
    if (matches.length !== 1)
      throw new Error(
        `Foundation fingerprint mismatch: expected demo branch ${definition.name}`,
      );
    const branch = matches[0];
    assertExactFields(
      branch,
      {
        address: definition.address,
        phone: definition.phone,
        email: definition.email,
        gstin: definition.gstin,
        isActive: true,
      },
      `branch ${definition.name}`,
    );
    return { _id: branch._id, definition };
  });

  const expectedUsers = buildDemoUsers(branches);
  for (const expected of expectedUsers) {
    const matches = users.filter((user) => user.username === expected.username);
    if (matches.length !== 1)
      throw new Error(
        `Foundation fingerprint mismatch: expected demo user ${expected.username}`,
      );
    const user = matches[0];
    assertExactFields(
      user,
      { role: expected.role, branchId: expected.branchId, status: "active" },
      `user ${expected.username}`,
    );
  }
  const expectedUsernames = new Set(expectedUsers.map((user) => user.username));
  if (users.some((user) => !expectedUsernames.has(user.username)))
    throw new Error("Foundation fingerprint mismatch: unexpected user found");
  for (const branch of branches) {
    const admin = users.find(
      (user) => user.username === branch.definition.username,
    );
    const branchDoc = branchDocs.find((row) => sameId(row._id, branch._id));
    if (!admin || !sameId(branchDoc.adminUser, admin._id))
      throw new Error(
        `Foundation fingerprint mismatch: canonical admin is not assigned to ${branch.definition.name}`,
      );
  }

  const menuByName = new Map(menu.map((item) => [item.ItemName, item]));
  for (const expected of MENU_ITEMS) {
    const actual = menuByName.get(expected.ItemName);
    if (!actual)
      throw new Error(
        `Foundation fingerprint mismatch: required menu item ${expected.ItemName} is missing`,
      );
    assertExactFields(
      actual,
      {
        category: expected.category,
        price: expected.price,
        available: expected.available,
      },
      `menu item ${expected.ItemName}`,
    );
  }

  const customersByPhone = new Map(
    customers.map((customer) => [customer.phone, customer]),
  );
  for (const expected of CUSTOMER_FIXTURE) {
    const actual = customersByPhone.get(expected.phone);
    if (!actual || actual.name !== expected.name)
      throw new Error(
        `Foundation fingerprint mismatch: customer identity ${expected.phone} is not the deterministic fixture`,
      );
  }

  const expectedInventory = buildInventory(branches);
  const inventorySignature = (item) =>
    JSON.stringify([
      String(item.branchId),
      item.name,
      item.unit,
      item.category,
      item.currentStock,
      item.lowStockThreshold,
      item.costPerUnit,
      item.supplier,
      item.isActive,
    ]);
  const actualInventory = inventory.map(inventorySignature).sort();
  const deterministicInventory = expectedInventory
    .map((item) => inventorySignature({ ...item, isActive: true }))
    .sort();
  if (JSON.stringify(actualInventory) !== JSON.stringify(deterministicInventory))
    throw new Error(
      "Foundation fingerprint mismatch: Inventory is not the deterministic demo fixture",
    );

  const globalSettings = settings.filter((row) => row.branchId == null);
  if (globalSettings.length !== 1)
    throw new Error(
      "Foundation fingerprint mismatch: expected one global Settings row",
    );
  assertExactFields(
    globalSettings[0],
    { businessName: "KOT POS Demo", address: "Bengaluru, Karnataka" },
    "global settings",
  );
  assertSettingsDefaults(globalSettings[0], "global settings");
  for (const branch of branches) {
    const matches = settings.filter((row) => sameId(row.branchId, branch._id));
    if (matches.length !== 1)
      throw new Error(
        `Foundation fingerprint mismatch: expected Settings for ${branch.definition.name}`,
      );
    assertExactFields(
      matches[0],
      {
        branchId: branch._id,
        businessName: branch.definition.name,
        address: branch.definition.address,
        phone: branch.definition.phone,
        email: branch.definition.email,
        gstin: branch.definition.gstin,
      },
      `settings ${branch.definition.name}`,
    );
    assertSettingsDefaults(matches[0], `settings ${branch.definition.name}`);
  }

  const inventoryIds = new Set(inventory.map((item) => String(item._id)));
  const userIds = new Set(users.map((user) => String(user._id)));
  const branchIds = new Set(branches.map((branch) => String(branch._id)));
  const inventoryById = new Map(
    inventory.map((item) => [String(item._id), item]),
  );
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  for (const item of inventory) {
    const itemLogs = logs
      .filter((log) => sameId(log.inventoryId, item._id))
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    if (
      itemLogs.length !== 2 ||
      itemLogs[0].note !== "Scheduled demo replenishment" ||
      itemLogs[1].note !== "Coherent demo movement" ||
      itemLogs[1].stockAfter !== item.currentStock
    )
      throw new Error(
        `Foundation fingerprint mismatch: stock baseline for ${item.name} is not pristine`,
      );
  }
  if (
    logs.some(
      (log) => {
        const item = inventoryById.get(String(log.inventoryId));
        const actor = usersById.get(String(log.doneBy));
        return (
          log.kotId != null ||
          !inventoryIds.has(String(log.inventoryId)) ||
          !userIds.has(String(log.doneBy)) ||
          !branchIds.has(String(log.branchId)) ||
          !sameId(item?.branchId, log.branchId) ||
          !sameId(actor?.branchId, log.branchId) ||
          log.stockAfter - log.stockBefore !== log.quantity
        );
      },
    )
  )
    throw new Error(
      "Foundation fingerprint mismatch: StockLogs are not the pristine demo baseline",
    );

  const stockLogSignature = (log) =>
    JSON.stringify([
      String(log.branchId),
      String(log.inventoryId),
      log.type,
      log.quantity,
      log.stockBefore,
      log.stockAfter,
      log.note,
      String(log.doneBy),
      log.kotId == null ? null : String(log.kotId),
    ]);
  const actualStockLogs = logs.map(stockLogSignature).sort();
  const expectedStockLogs = buildStockLogs(inventory, users)
    .map((log) => stockLogSignature({ ...log, kotId: null }))
    .sort();
  if (JSON.stringify(actualStockLogs) !== JSON.stringify(expectedStockLogs))
    throw new Error(
      "Foundation fingerprint mismatch: StockLogs are not the exact deterministic demo baseline",
    );

  return {
    branches,
    branchDocs,
    users,
    menu,
    customers,
    inventory,
    settings,
  };
}

function assertNoRuntimeOperationalReferences(logs, kots) {
  const targetKotIds = new Set(kots.map((kot) => String(kot._id)));
  if (
    logs.some(
      (log) => log.kotId != null && targetKotIds.has(String(log.kotId)),
    )
  )
    throw new Error(
      "Operational reseed refused because runtime stock history references existing KOT records.",
    );
  // AuditEvent entity IDs and metadata IDs are append-only logical strings. They
  // are intentionally preserved and may refer to pre-reset demo operational IDs.
}

async function readFoundation(session) {
  const attach = (query) => (session ? query.session(session) : query);
  const [branchDocs, users, menu, customers, inventory, settings, logs, kots] =
    await Promise.all([
      attach(Branch.find({}).lean()),
      attach(User.find({}).lean()),
      attach(MenuItem.find({}).lean()),
      attach(Customer.find({}).lean()),
      attach(Inventory.find({}).lean()),
      attach(Settings.find({}).lean()),
      attach(StockLog.find({}).lean()),
      attach(Kot.find({}).select("_id").lean()),
    ]);
  return { branchDocs, users, menu, customers, inventory, settings, logs, kots };
}

function canonicalDocuments(rows) {
  const normalize = (value) => {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, normalize(value[key])]),
      );
    return value;
  };
  return JSON.stringify(
    rows
      .map(normalize)
      .sort((left, right) => String(left._id).localeCompare(String(right._id))),
  );
}

function foundationIdentitySnapshot(foundation) {
  const ids = (rows) => rows.map((row) => String(row._id)).sort();
  return {
    branches: canonicalDocuments(foundation.branchDocs),
    users: canonicalDocuments(foundation.users),
    menu: canonicalDocuments(foundation.menu),
    customers: ids(foundation.customers),
    inventory: canonicalDocuments(foundation.inventory),
    settings: canonicalDocuments(foundation.settings),
    stockLogs: canonicalDocuments(foundation.logs),
  };
}

function assertFoundationUnchanged(before, after, allowAuditGrowth = false) {
  if (JSON.stringify(before.customers) !== JSON.stringify(after.customers))
    throw new Error(
      "Preserved foundation changed during operational reset: customers",
    );
  for (const key of [
    "branches",
    "users",
    "menu",
    "inventory",
    "settings",
    "stockLogs",
  ])
    if (before[key] !== after[key])
      throw new Error(`Preserved foundation changed during operational reset: ${key}`);
  if (
    before.auditEvents != null &&
    after.auditEvents != null &&
    (allowAuditGrowth
      ? after.auditEvents < before.auditEvents
      : after.auditEvents !== before.auditEvents)
  )
    throw new Error("AuditEvents were removed during operational reset");
}

function assertDistribution(actualRows, keyFor, expected, label) {
  const counts = new Map();
  for (const row of actualRows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, count] of Object.entries(expected))
    if ((counts.get(key) || 0) !== count)
      throw new Error(
        `Operations-only verification failed: ${label} ${key} expected ${count}, got ${counts.get(key) || 0}`,
      );
}

function itemsTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

async function verifyOperationalSeed(context, session) {
  const attach = (query) => (session ? query.session(session) : query);
  const [tables, orders, takeaways, kots, bills, customers, inventory, logs, auditEvents] =
    await Promise.all([
      attach(Table.find({}).lean()),
      attach(TableOrder.find({}).lean()),
      attach(TakeAway.find({}).lean()),
      attach(Kot.find({}).lean()),
      attach(Billing.find({}).lean()),
      attach(Customer.find({}).lean()),
      attach(Inventory.find({}).lean()),
      attach(StockLog.find({}).lean()),
      attach(AuditEvent.countDocuments({})),
    ]);
  const counts = {
    tables: tables.length,
    tableOrders: orders.length,
    takeaways: takeaways.length,
    kots: kots.length,
    bills: bills.length,
  };
  if (JSON.stringify(counts) !== JSON.stringify({
    tables: 36,
    tableOrders: 116,
    takeaways: 42,
    kots: 143,
    bills: 133,
  }))
    throw new Error(
      `Operations-only verification failed: unexpected counts ${JSON.stringify(counts)}`,
    );

  assertDistribution(
    tables,
    (table) => table.status,
    { available: 18, occupied: 9, reserved: 4, billing: 5 },
    "table status",
  );
  assertDistribution(
    orders,
    (order) => order.status,
    { served: 92, cancelled: 15, sent_to_kitchen: 9, pending: 0 },
    "TableOrder status",
  );
  assertDistribution(
    kots,
    (kot) => kot.status,
    { pending: 4, preparing: 3, ready: 3, served: 133, cancelled: 0 },
    "KOT status",
  );
  assertDistribution(
    bills,
    (bill) => bill.paymentStatus,
    { paid: 128, unpaid: 5 },
    "bill payment status",
  );
  assertDistribution(
    bills,
    (bill) => bill.paymentMethod,
    { upi: 52, card: 39, cash: 37, none: 5 },
    "bill payment method",
  );

  const tableById = new Map(tables.map((table) => [String(table._id), table]));
  const userById = new Map(context.users.map((user) => [String(user._id), user]));
  const menuById = new Map(context.menu.map((item) => [String(item._id), item]));
  const branchById = new Map(
    context.branches.map((branch) => [String(branch._id), branch]),
  );
  const branchKeyForCreator = (row) => {
    const user = userById.get(String(row.createdBy));
    return branchById.get(String(user?.branchId))?.definition.key || "invalid";
  };
  const branchKeyForTable = (row) =>
    branchById.get(String(tableById.get(String(row.tableId))?.branchId))
      ?.definition.key || "invalid";
  const branchKeyForKot = (kot) =>
    branchById.get(String(kot.branchId))?.definition.key || "invalid";

  assertDistribution(
    tables,
    (table) => branchById.get(String(table.branchId))?.definition.key || "invalid",
    { indiranagar: 14, whitefield: 12, jayanagar: 10 },
    "table branch",
  );
  assertDistribution(
    orders,
    branchKeyForTable,
    { indiranagar: 58, whitefield: 35, jayanagar: 23 },
    "TableOrder branch",
  );
  assertDistribution(
    takeaways,
    branchKeyForCreator,
    { indiranagar: 23, whitefield: 11, jayanagar: 8 },
    "TakeAway branch",
  );
  assertDistribution(
    kots,
    branchKeyForKot,
    { indiranagar: 71, whitefield: 43, jayanagar: 29 },
    "KOT branch",
  );
  assertDistribution(
    bills,
    branchKeyForCreator,
    { indiranagar: 66, whitefield: 40, jayanagar: 27 },
    "Bill branch",
  );

  const expectedTableStates = {
    indiranagar: { available: 4, occupied: 4, reserved: 4, billing: 2 },
    whitefield: { available: 7, occupied: 3, reserved: 0, billing: 2 },
    jayanagar: { available: 7, occupied: 2, reserved: 0, billing: 1 },
  };
  for (const branch of context.branches) {
    const branchTables = tables.filter((table) => sameId(table.branchId, branch._id));
    assertDistribution(
      branchTables,
      (table) => table.status,
      expectedTableStates[branch.definition.key],
      `${branch.definition.key} table status`,
    );
    const numbers = branchTables.map((table) => table.tableNumber).sort((a, b) => a - b);
    if (
      new Set(numbers).size !== branch.definition.tableCount ||
      numbers.some((number, index) => number !== index + 1)
    )
      throw new Error(
        `Operations-only verification failed: table numbering for ${branch.definition.key}`,
      );
  }

  const validateItems = (row, label) => {
    for (const item of row.items) {
      const menuItem = menuById.get(String(item.itemId));
      if (
        !menuItem ||
        item.name !== menuItem.ItemName ||
        item.price !== menuItem.price ||
        item.quantity < 1
      )
        throw new Error(
          `Operations-only verification failed: invalid item snapshot in ${label}`,
        );
    }
  };
  for (const order of orders) {
    const table = tableById.get(String(order.tableId));
    const creator = userById.get(String(order.createdBy));
    validateItems(order, "TableOrder");
    if (
      !table ||
      !creator ||
      !sameId(creator.branchId, table.branchId) ||
      order.tableNumber !== table.tableNumber ||
      order.totalAmount !== itemsTotal(order.items)
    )
      throw new Error(
        "Operations-only verification failed: TableOrder reference, branch, or total",
      );
  }
  for (const takeaway of takeaways) {
    const creator = userById.get(String(takeaway.createdBy));
    validateItems(takeaway, "TakeAway");
    if (!creator || !branchById.has(String(creator.branchId)))
      throw new Error(
        "Operations-only verification failed: TakeAway creator branch",
      );
  }
  for (const kot of kots) {
    const creator = userById.get(String(kot.createdBy));
    validateItems(kot, "KOT");
    if (
      !branchById.has(String(kot.branchId)) ||
      !creator ||
      !sameId(creator.branchId, kot.branchId) ||
      kot.totalAmount !== itemsTotal(kot.items)
    )
      throw new Error(
        "Operations-only verification failed: KOT creator, branch, or total",
      );
    if (kot.orderType === "dine-in") {
      const table = tableById.get(String(kot.tableId));
      if (
        !table ||
        !sameId(table.branchId, kot.branchId) ||
        table.tableNumber !== kot.tableNumber
      )
        throw new Error(
          "Operations-only verification failed: dine-in KOT table branch",
        );
    }
  }
  for (const bill of bills) {
    const creator = userById.get(String(bill.createdBy));
    const table = bill.tableId ? tableById.get(String(bill.tableId)) : null;
    validateItems(bill, "Bill");
    if (
      !creator ||
      !branchById.has(String(creator.branchId)) ||
      bill.totalAmount !== itemsTotal(bill.items) ||
      bill.items.some((item) => item.total !== item.price * item.quantity) ||
      (bill.tableId &&
        (!table || !sameId(table.branchId, creator?.branchId)))
    )
      throw new Error(
        "Operations-only verification failed: Bill reference, branch, or total",
      );
    if (
      (bill.paymentStatus === "paid" &&
        (!bill.paidAt || bill.paymentMethod === "none")) ||
      (bill.paymentStatus === "unpaid" &&
        (bill.paidAt || bill.paymentMethod !== "none"))
    )
      throw new Error("Operations-only verification failed: payment consistency");
  }
  if (new Set(bills.map((bill) => bill.billNumber)).size !== bills.length)
    throw new Error("Operations-only verification failed: duplicate billNumber");

  const today = startOfToday();
  const paid = bills.filter((bill) => bill.paymentStatus === "paid");
  const historicalOrders = orders.filter(
    (order) => new Date(order.createdAt) < today,
  );
  const historicalTakeaways = takeaways.filter(
    (takeaway) => new Date(takeaway.createdAt) < today,
  );
  if (
    paid.filter((bill) => new Date(bill.createdAt) >= today).length !== 8 ||
    paid.filter((bill) => new Date(bill.createdAt) < today).length !== 120 ||
    bills.filter(
      (bill) =>
        bill.paymentStatus === "unpaid" && new Date(bill.createdAt) >= today,
    ).length !== 5 ||
    historicalOrders.length !== 102 ||
    orders.length - historicalOrders.length !== 14 ||
    historicalTakeaways.length !== 33 ||
    takeaways.length - historicalTakeaways.length !== 9
  )
    throw new Error("Operations-only verification failed: operational time split");

  const activeOrders = orders.filter((order) =>
    ["pending", "sent_to_kitchen"].includes(order.status),
  );
  const activeKots = kots.filter((kot) =>
    ["pending", "preparing", "ready"].includes(kot.status),
  );
  const occupiedTables = tables.filter((table) => table.status === "occupied");
  const billingTables = tables.filter((table) => table.status === "billing");
  const unpaidBills = bills.filter((bill) => bill.paymentStatus === "unpaid");
  for (const table of occupiedTables) {
    const matches = activeOrders.filter((order) => sameId(order.tableId, table._id));
    const activeKots = kots.filter(
      (kot) =>
        sameId(kot.tableId, table._id) &&
        ["pending", "preparing", "ready"].includes(kot.status),
    );
    if (
      matches.length !== 1 ||
      activeKots.length !== 1 ||
      table.currentCustomer?.name !== matches[0].customerName ||
      table.currentCustomer?.phone !== activeKots[0].customerPhone
    )
      throw new Error(
        "Operations-only verification failed: occupied table workflow",
      );
  }
  for (const table of billingTables) {
    const tableBills = unpaidBills.filter((bill) => sameId(bill.tableId, table._id));
    const servedOrders = orders.filter(
      (order) =>
        sameId(order.tableId, table._id) &&
        order.status === "served" &&
        new Date(order.createdAt) >= today,
    );
    const servedKots = kots.filter(
      (kot) =>
        sameId(kot.tableId, table._id) &&
        kot.status === "served" &&
        new Date(kot.createdAt) >= today,
    );
    if (
      tableBills.length !== 1 ||
      servedOrders.length !== 1 ||
      servedKots.length !== 1 ||
      table.currentCustomer?.name !== tableBills[0].customerName ||
      table.currentCustomer?.phone !== tableBills[0].customerPhone
    )
      throw new Error(
        "Operations-only verification failed: billing table workflow",
      );
  }
  if (
    activeOrders.length !== 9 ||
    activeKots.length !== 10 ||
    activeKots.filter((kot) => kot.orderType === "dine-in").length !== 9 ||
    activeKots.filter((kot) => kot.orderType === "takeaway").length !== 1 ||
    unpaidBills.length !== 5 ||
    tables
      .filter((table) => table.status === "available")
      .some(
        (table) =>
          activeOrders.some((order) => sameId(order.tableId, table._id)) ||
          activeKots.some(
            (kot) =>
              kot.orderType === "dine-in" && sameId(kot.tableId, table._id),
          ),
      )
  )
    throw new Error("Operations-only verification failed: active table workflow");

  const metrics = calculateCustomerMetrics(customers, bills, orders, takeaways);
  for (const customer of customers) {
    const expected = metrics.get(customer.phone);
    if (
      customer.totalOrders !== expected.totalOrders ||
      customer.totalSpent !== expected.totalSpent ||
      String(customer.lastVisit || "") !== String(expected.lastVisit || "")
    )
      throw new Error(
        `Operations-only verification failed: customer metrics for ${customer.phone}`,
      );
  }

  if (context.preservedSnapshot) {
    const after = {
      ...foundationIdentitySnapshot({
        branchDocs: context.branchDocs,
        users: context.users,
        menu: context.menu,
        customers,
        inventory,
        settings: context.settings,
        logs,
      }),
      auditEvents,
    };
    assertFoundationUnchanged(context.preservedSnapshot, after);
  }
  return counts;
}

async function verifySeed(branches) {
  const [
    users,
    branchDocs,
    tables,
    menu,
    inventory,
    customers,
    bills,
    kots,
    orders,
    takeaways,
    logs,
  ] = await Promise.all([
    User.find({}).lean(),
    Branch.find({}).lean(),
    Table.find({}).lean(),
    MenuItem.find({}).lean(),
    Inventory.find({}).lean(),
    Customer.find({}).lean(),
    Billing.find({}).lean(),
    Kot.find({}).lean(),
    TableOrder.find({}).lean(),
    TakeAway.find({}).lean(),
    StockLog.find({}).lean(),
  ]);
  if (
    users.length !== 25 ||
    users.filter((u) => u.role === "superadmin").length !== 1 ||
    users.filter((u) => u.role === "admin").length !== 3
  )
    throw new Error("User topology verification failed");
  if (
    branchDocs.length !== 3 ||
    tables.length !== 36 ||
    menu.length !== 80 ||
    inventory.length !== 45 ||
    customers.length !== 120
  )
    throw new Error("Foundation or expanded count verification failed");
  if (
    bills.length !== 133 ||
    bills.filter((b) => b.paymentStatus === "unpaid").length !== 5 ||
    bills.filter((b) => b.paymentStatus === "paid").length !== 128
  )
    throw new Error("Billing count verification failed");
  if (
    tables.filter((t) => t.status === "billing").length !== 5 ||
    kots.length !== 143 ||
    orders.length !== 116 ||
    takeaways.length !== 42 ||
    logs.length !== 90
  )
    throw new Error("Operational count verification failed");
  if (
    bills.some(
      (b) =>
        b.paymentStatus === "paid" && (!b.paidAt || b.paymentMethod === "none"),
    ) ||
    bills.some(
      (b) =>
        b.paymentStatus === "unpaid" &&
        (b.paidAt || b.paymentMethod !== "none"),
    )
  )
    throw new Error("Payment consistency verification failed");
  if (
    new Set(bills.map((b) => b.billNumber)).size !== bills.length ||
    new Set(customers.map((c) => c.phone)).size !== customers.length
  )
    throw new Error("Unique identity verification failed");
  for (const item of inventory) {
    const itemLogs = logs.filter(
      (log) => String(log.inventoryId) === String(item._id),
    );
    if (
      itemLogs.length &&
      itemLogs.sort((a, b) => a.createdAt - b.createdAt).at(-1).stockAfter !==
        item.currentStock
    )
      throw new Error(`Stock reconciliation failed for ${item.name}`);
    if (item.currentStock < 0)
      throw new Error(`Negative stock for ${item.name}`);
  }
  const indexes = {
    user: await listTableIndexes(User.collection),
    branch: await listTableIndexes(Branch.collection),
    table: await listTableIndexes(Table.collection),
  };
  const hasIndex = (list, key, name) =>
    list.some(
      (index) =>
        index.name === name ||
        JSON.stringify(index.key) === JSON.stringify(key),
    );
  if (
    !hasIndex(
      indexes.user,
      { branchId: 1, role: 1 },
      "uniq_user_branch_admin_per_branch",
    ) ||
    !hasIndex(
      indexes.branch,
      { adminUser: 1 },
      "uniq_branch_admin_user_when_present",
    ) ||
    !hasIndex(indexes.table, { branchId: 1, tableNumber: 1 })
  )
    throw new Error("Required index verification failed");
  console.log(
    `Verified: ${users.length} users, ${branchDocs.length} branches, ${tables.length} tables, ${menu.length} menu items, ${inventory.length} inventory, ${customers.length} customers, ${orders.length + takeaways.length} historical/current order records, ${bills.length} bills, ${kots.length} KOTs, ${logs.length} stock logs.`,
  );
  return {
    users,
    branchDocs,
    tables,
    menu,
    inventory,
    customers,
    bills,
    kots,
    orders,
    takeaways,
    logs,
  };
}

async function lightweightOperationsVerification(expectedFoundation) {
  const [tables, orders, takeaways, kots, bills, foundation, auditEvents] =
    await Promise.all([
      Table.countDocuments({}),
      TableOrder.countDocuments({}),
      TakeAway.countDocuments({}),
      Kot.countDocuments({}),
      Billing.countDocuments({}),
      readFoundation(),
      AuditEvent.countDocuments({}),
    ]);
  const counts = { tables, tableOrders: orders, takeaways, kots, bills };
  if (
    tables !== 36 ||
    orders !== 116 ||
    takeaways !== 42 ||
    kots !== 143 ||
    bills !== 133
  )
    throw new Error(
      `Post-commit operations-only verification failed: ${JSON.stringify(counts)}`,
    );
  assertNoRuntimeOperationalReferences(foundation.logs, foundation.kots);
  assertFoundationFingerprint(foundation);
  const after = {
    ...foundationIdentitySnapshot(foundation),
    auditEvents,
  };
  assertFoundationUnchanged(expectedFoundation, after, true);
  return counts;
}

async function performOperationsOnlyReset(session, options = {}) {
  const afterStage = options.afterStage || (async () => {});
  const foundation = await readFoundation(session);
  assertNoRuntimeOperationalReferences(foundation.logs, foundation.kots);
  const context = assertFoundationFingerprint(foundation);
  const auditEvents = await AuditEvent.countDocuments({}).session(session);
  context.auditEvents = auditEvents;
  context.preservedSnapshot = {
    ...foundationIdentitySnapshot(foundation),
    auditEvents,
  };
  if (options.expectedFoundation)
    assertFoundationUnchanged(options.expectedFoundation, context.preservedSnapshot);

  await Billing.deleteMany({}, { session });
  await Kot.deleteMany({}, { session });
  await TableOrder.deleteMany({}, { session });
  await TakeAway.deleteMany({}, { session });
  await Table.deleteMany({}, { session });
  await afterStage("delete", { session });

  const tables = await Table.insertMany(buildDemoTables(context.branches), {
    session,
    ordered: true,
  });
  await afterStage("tables", { session });
  const history = buildHistoricalStories(
    context.branches,
    tables,
    context.users,
    context.menu,
    context.customers,
  );
  const current = await createOperationalStories(
    context.branches,
    tables,
    context.users,
    context.menu,
    context.customers,
  );
  const tableOrders = [...history.tableOrders, ...current.tableOrders];
  const takeaways = [...history.takeaways, ...current.takeaways];
  const kots = [...history.kots, ...current.kots];
  const bills = [...history.bills, ...current.bills];

  await TableOrder.insertMany(tableOrders, { session, ordered: true });
  await afterStage("table-orders", { session });
  await TakeAway.insertMany(takeaways, { session, ordered: true });
  await afterStage("takeaways", { session });
  await Kot.insertMany(kots, { session, ordered: true });
  await afterStage("kots", { session });
  await Billing.insertMany(bills, { session, ordered: true });
  await afterStage("bills", { session });
  await Table.bulkWrite(
    tables.map((table) => ({
      updateOne: {
        filter: { _id: table._id },
        update: {
          $set: {
            status: table.status,
            currentCustomer: table.currentCustomer || null,
          },
        },
      },
    })),
    { session },
  );
  await updateCustomerMetrics(
    context.customers,
    bills,
    tableOrders,
    takeaways,
    session,
  );
  await afterStage("customer-metrics", { session });
  const counts = await verifyOperationalSeed(context, session);
  await afterStage("final-verification", { session });
  return counts;
}

async function operationsOnlySeed(options = {}) {
  await mongoose.connect(process.env.MONGO_URI);
  let session;
  try {
    assertOperationsOnlyTarget();
    const preflight = await readFoundation();
    assertNoRuntimeOperationalReferences(preflight.logs, preflight.kots);
    assertFoundationFingerprint(preflight);
    const expectedFoundation = {
      ...foundationIdentitySnapshot(preflight),
      auditEvents: await AuditEvent.countDocuments({}),
    };
    session = await mongoose.startSession();
    let counts;
    await session.withTransaction(async () => {
      counts = await performOperationsOnlyReset(session, {
        ...options,
        expectedFoundation,
      });
    });
    await lightweightOperationsVerification(expectedFoundation);
    console.log(
      `Operations-only demo reseed complete: ${counts.tables} tables, ${counts.tableOrders} TableOrders, ${counts.takeaways} TakeAways, ${counts.kots} KOTs, ${counts.bills} bills. Foundation records were preserved.`,
    );
    return counts;
  } finally {
    if (session) await session.endSession();
    await mongoose.disconnect();
  }
}

async function customerOnlySeed() {
  await mongoose.connect(process.env.MONGO_URI);
  assertDisposableDemoTarget();
  const session = await mongoose.startSession();
  try {
    let summary;
    await session.withTransaction(async () => {
      summary = await reseedCustomersOnly(session);
    });
    console.log(
      `Customer-only seed complete: ${summary.count} customers, ${summary.phones} unique phones; historical transactions unchanged.`,
    );
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

async function seed(mode = "full") {
  if (mode === "customers-only") return customerOnlySeed();
  if (mode === "operations-only") return operationsOnlySeed();
  const clean = mode === "clean";
  await mongoose.connect(process.env.MONGO_URI);
  assertDisposableDemoTarget();
  const session = await mongoose.startSession();
  try {
    if (clean) {
      console.log("Cleaning guarded development database Kot-Pos...");
      await cleanDatabase();
    }
    await ensureIndexes();
    let branches, users, tables, menu, inventory, customers;
    await session.withTransaction(async () => {
      branches = [];
      for (const definition of DEMO_BRANCHES) {
        const [branch] = await Branch.create([branchDocument(definition)], {
          session,
        });
        branches.push({ _id: branch._id, definition });
      }
      users = await User.create(buildDemoUsers(branches), {
        session,
        ordered: true,
      });
      const byUsername = Object.fromEntries(
        users.map((user) => [user.username, user]),
      );
      for (const branch of branches)
        await Branch.updateOne(
          { _id: branch._id },
          {
            $set: {
              adminUser: byUsername[branch.definition.username]._id,
              isActive: true,
            },
          },
          { session },
        );
      await Settings.create(
        [
          {
            branchId: null,
            businessName: "KOT POS Demo",
            address: "Bengaluru, Karnataka",
          },
          ...branches.map(({ _id, definition }) => ({
            branchId: _id,
            businessName: definition.name,
            address: definition.address,
            phone: definition.phone,
            email: definition.email,
            gstin: definition.gstin,
          })),
        ],
        { session, ordered: true },
      );
      menu = await MenuItem.insertMany(MENU_ITEMS, { session });
      tables = await Table.insertMany(buildDemoTables(branches), { session });
      inventory = await Inventory.insertMany(buildInventory(branches), {
        session,
      });
      customers = await Customer.insertMany(CUSTOMER_FIXTURE, { session });
      const history = buildHistoricalStories(
        branches,
        tables,
        users,
        menu,
        customers,
      );
      const current = await createOperationalStories(
        branches,
        tables,
        users,
        menu,
        customers,
      );
      await TableOrder.insertMany(
        [...history.tableOrders, ...current.tableOrders],
        { session },
      );
      await TakeAway.insertMany([...history.takeaways, ...current.takeaways], {
        session,
      });
      await Kot.insertMany([...history.kots, ...current.kots], { session });
      await Billing.insertMany([...history.bills, ...current.bills], {
        session,
      });
      await StockLog.insertMany(buildStockLogs(inventory, users), { session });
      await Table.bulkWrite(
        tables.map((table) => ({
          updateOne: {
            filter: { _id: table._id },
            update: {
              $set: {
                status: table.status,
                currentCustomer: table.currentCustomer || null,
              },
            },
          },
        })),
        { session },
      );
      await updateCustomerMetrics(
        customers,
        [...history.bills, ...current.bills],
        [...history.tableOrders, ...current.tableOrders],
        [...history.takeaways, ...current.takeaways],
        session,
      );
    });
    await verifySeed(branches);
    console.log("\nDEMO USERNAMES (password is never printed)");
    console.log("Superadmin: superadmin");
    for (const branch of branches)
      console.log(
        `Branch Admin (${branch.definition.name}): ${branch.definition.username}`,
      );
    console.log("Waiter: waiter.indiranagar.1");
    console.log("Chef: chef.indiranagar.1");
    console.log("Cashier: cashier.indiranagar.1");
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}
if (require.main === module)
  Promise.resolve()
    .then(() => seed(getSeedMode(process.argv)))
    .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  });
module.exports = {
  DEMO_BRANCHES,
  MENU_ITEMS,
  CUSTOMER_FIXTURE,
  INVENTORY_FIXTURE,
  MENU_DISTRIBUTION,
  BRANCH_COUNTS,
  buildDemoUsers,
  buildDemoTables,
  branchDocument,
  assertDisposableDemoTarget,
  assertOperationsOnlyTarget,
  assertCustomerSnapshotsMatchFixture,
  reseedCustomersOnly,
  customerOnlySeed,
  getSeedMode,
  buildMenuItems,
  buildCustomers,
  buildInventory,
  buildHistoricalStories,
  createOperationalStories,
  buildStockLogs,
  calculateCustomerMetrics,
  assertFoundationFingerprint,
  assertNoRuntimeOperationalReferences,
  foundationIdentitySnapshot,
  assertFoundationUnchanged,
  verifyOperationalSeed,
  performOperationsOnlyReset,
  operationsOnlySeed,
  lightweightOperationsVerification,
  verifySeed,
  seed,
};
