const Kot = require("./kot");
const Billing = require("./billings");
const User = require("./users");
const Table = require("./tables");
const MenuItem = require("./menuItems");
const Branch = require("./Branch");

const REQUIRED_TABLE_INDEX = Object.freeze({ branchId: 1, tableNumber: 1 });

const hasExactKey = (index, expectedKey) => {
  const actualEntries = Object.entries(index?.key || {});
  const expectedEntries = Object.entries(expectedKey);
  return (
    actualEntries.length === expectedEntries.length &&
    expectedEntries.every(
      ([field, direction], position) =>
        actualEntries[position]?.[0] === field &&
        actualEntries[position]?.[1] === direction,
    )
  );
};

const isRequiredTableIndex = (index) =>
  index?.unique === true &&
  index?.sparse !== true &&
  !index?.partialFilterExpression &&
  hasExactKey(index, REQUIRED_TABLE_INDEX);

const isObsoleteGlobalTableNumberIndex = (index) =>
  index?.unique === true && hasExactKey(index, { tableNumber: 1 });

const listTableIndexes = async (collection) => {
  try {
    return await collection.indexes();
  } catch (err) {
    if (err?.code === 26 || err?.codeName === "NamespaceNotFound") return [];
    throw err;
  }
};

async function ensureRequiredTableIndexes(collection = Table.collection) {
  let indexes = await listTableIndexes(collection);

  if (!indexes.some(isRequiredTableIndex)) {
    await collection.createIndex(REQUIRED_TABLE_INDEX, { unique: true });
    indexes = await listTableIndexes(collection);
  }

  if (!indexes.some(isRequiredTableIndex)) {
    throw new Error(
      "Required Table index { branchId: 1, tableNumber: 1 } unique was not established",
    );
  }

  for (const index of indexes.filter(isObsoleteGlobalTableNumberIndex)) {
    await collection.dropIndex(index.name);
  }

  const finalIndexes = await listTableIndexes(collection);
  if (!finalIndexes.some(isRequiredTableIndex)) {
    throw new Error(
      "Required Table index { branchId: 1, tableNumber: 1 } unique is missing after reconciliation",
    );
  }
  if (finalIndexes.some(isObsoleteGlobalTableNumberIndex)) {
    throw new Error(
      "Obsolete global Table tableNumber unique index remains after reconciliation",
    );
  }
}

async function ensureOptionalIndexes() {
  await Kot.collection.createIndex({ branchId: 1, status: 1 });
  await Kot.collection.createIndex({ branchId: 1, createdAt: -1 });
  await Kot.collection.createIndex({
    branchId: 1,
    orderType: 1,
    createdAt: -1,
  });
  await Kot.collection.createIndex({ createdBy: 1, createdAt: -1 });
  await Kot.collection.createIndex({ tableId: 1, status: 1 });
  await Kot.collection.createIndex({
    customerName: "text",
    customerPhone: "text",
  });

  await Billing.collection.createIndex({ branchId: 1, createdAt: -1 });
  await Billing.collection.createIndex({
    branchId: 1,
    paymentStatus: 1,
    createdAt: -1,
  });
  await Billing.collection.createIndex({ branchId: 1, paymentMethod: 1 });
  await Billing.collection.createIndex({ createdBy: 1, createdAt: -1 });
  await Billing.collection.createIndex({ billNumber: 1 }, { unique: true });
  await Billing.collection.createIndex({
    customerName: "text",
    customerPhone: "text",
    billNumber: "text",
  });

  await User.collection.createIndex({ branchId: 1, role: 1 });
  await User.collection.createIndex({ username: 1 }, { unique: true });
  await User.collection.createIndex({ role: 1, status: 1 });

  // Performance-only floor-view index. Ownership uniqueness is required above.
  await Table.collection.createIndex({ branchId: 1, status: 1 });

  await MenuItem.collection.createIndex({ category: 1, available: 1 });
  await MenuItem.collection.createIndex({ ItemName: "text" });
  await MenuItem.collection.createIndex({ available: 1 });
  await Branch.collection.createIndex({ isActive: 1 });
}

async function ensureIndexes({
  tableCollection = Table.collection,
  optionalInitializer = ensureOptionalIndexes,
} = {}) {
  try {
    await ensureRequiredTableIndexes(tableCollection);
  } catch (err) {
    err.code = err.code || "REQUIRED_TABLE_INDEX_INITIALIZATION_FAILED";
    console.error("Required Table index initialization failed:", err.message);
    throw err;
  }

  try {
    await optionalInitializer();
    console.log("All DB indexes ensured");
  } catch (err) {
    console.error("Optional index creation warning:", err.message);
  }
}

module.exports = {
  REQUIRED_TABLE_INDEX,
  ensureIndexes,
  ensureOptionalIndexes,
  ensureRequiredTableIndexes,
  hasExactKey,
  isObsoleteGlobalTableNumberIndex,
  isRequiredTableIndex,
  listTableIndexes,
};
