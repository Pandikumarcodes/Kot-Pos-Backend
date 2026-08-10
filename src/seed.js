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
const { ensureIndexes, listTableIndexes } = require("./models/indexes");
const { buildMenuItems, MENU_DISTRIBUTION } = require("./seedData/menuItems");
const { buildCustomers } = require("./seedData/customers");
const { buildInventory, BRANCH_COUNTS } = require("./seedData/inventory");

const CLEAN = process.argv.includes("--clean");
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

function assertDisposableDemoTarget() {
  const databaseName = mongoose.connection.db?.databaseName;
  if (process.env.NODE_ENV !== "development" || databaseName !== "Kot-Pos")
    throw new Error(
      `Refusing destructive seed clean: expected development/Kot-Pos, got ${process.env.NODE_ENV || "unset"}/${databaseName || "unknown"}`,
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
  await Promise.all(
    customers.map((customer) =>
      Customer.updateOne(
        { _id: customer._id },
        { $set: metrics.get(customer.phone) },
        { session },
      ),
    ),
  );
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

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  assertDisposableDemoTarget();
  const session = await mongoose.startSession();
  try {
    if (CLEAN) {
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
    console.log(
      `\nDEMO CREDENTIALS (password: ${DEMO_PASSWORD}; hashes are never printed)`,
    );
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
  seed().catch((error) => {
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
  buildMenuItems,
  buildCustomers,
  buildInventory,
  buildHistoricalStories,
  createOperationalStories,
  buildStockLogs,
  verifySeed,
  seed,
};
