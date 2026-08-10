const Kot = require("./kot");
const Billing = require("./billings");
const User = require("./users");
const Table = require("./tables");
const MenuItem = require("./menuItems");
const Branch = require("./Branch");

const REQUIRED_TABLE_INDEX = Object.freeze({ branchId: 1, tableNumber: 1 });
const REQUIRED_BRANCH_ADMIN_USER_INDEX = Object.freeze({ branchId: 1, role: 1 });
const REQUIRED_BRANCH_ADMIN_POINTER_INDEX = Object.freeze({ adminUser: 1 });
const BRANCH_ADMIN_USER_INDEX_OPTIONS = Object.freeze({
  unique: true,
  name: "uniq_user_branch_admin_per_branch",
  partialFilterExpression: {
    role: "admin",
    branchId: { $type: "objectId" },
  },
});
const BRANCH_ADMIN_POINTER_INDEX_OPTIONS = Object.freeze({
  unique: true,
  name: "uniq_branch_admin_user_when_present",
  partialFilterExpression: {
    adminUser: { $type: "objectId" },
  },
});

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

const isRequiredBranchAdminUserIndex = (index) =>
  index?.unique === true &&
  hasExactKey(index, REQUIRED_BRANCH_ADMIN_USER_INDEX) &&
  JSON.stringify(index.partialFilterExpression || {}) ===
    JSON.stringify(BRANCH_ADMIN_USER_INDEX_OPTIONS.partialFilterExpression);

const isRequiredBranchAdminPointerIndex = (index) =>
  index?.unique === true &&
  hasExactKey(index, REQUIRED_BRANCH_ADMIN_POINTER_INDEX) &&
  JSON.stringify(index.partialFilterExpression || {}) ===
    JSON.stringify(BRANCH_ADMIN_POINTER_INDEX_OPTIONS.partialFilterExpression);

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

async function assertNoDuplicateBranchAdmins() {
  const conflicts = await User.aggregate([
    { $match: { role: "admin", branchId: { $type: "objectId" } } },
    { $group: { _id: "$branchId", count: { $sum: 1 }, users: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]);
  if (conflicts.length) {
    throw new Error(
      `Duplicate branch admins exist for branch ${conflicts[0]._id}; reconcile data before startup`,
    );
  }
}

async function assertNoDuplicateBranchAdminPointers() {
  const conflicts = await Branch.aggregate([
    { $match: { adminUser: { $type: "objectId" } } },
    { $group: { _id: "$adminUser", count: { $sum: 1 }, branches: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]);
  if (conflicts.length) {
    throw new Error(
      `Branch admin user ${conflicts[0]._id} is assigned to multiple branches; reconcile data before startup`,
    );
  }
}

async function ensureRequiredBranchAdminIndexes({
  userCollection = User.collection,
  branchCollection = Branch.collection,
} = {}) {
  await assertNoDuplicateBranchAdmins();
  await assertNoDuplicateBranchAdminPointers();

  let userIndexes = await listTableIndexes(userCollection);
  if (!userIndexes.some(isRequiredBranchAdminUserIndex)) {
    await userCollection.createIndex(
      REQUIRED_BRANCH_ADMIN_USER_INDEX,
      BRANCH_ADMIN_USER_INDEX_OPTIONS,
    );
    userIndexes = await listTableIndexes(userCollection);
  }
  if (!userIndexes.some(isRequiredBranchAdminUserIndex)) {
    throw new Error("Required User branch-admin unique index was not established");
  }

  let branchIndexes = await listTableIndexes(branchCollection);
  if (!branchIndexes.some(isRequiredBranchAdminPointerIndex)) {
    await branchCollection.createIndex(
      REQUIRED_BRANCH_ADMIN_POINTER_INDEX,
      BRANCH_ADMIN_POINTER_INDEX_OPTIONS,
    );
    branchIndexes = await listTableIndexes(branchCollection);
  }
  if (!branchIndexes.some(isRequiredBranchAdminPointerIndex)) {
    throw new Error("Required Branch adminUser unique index was not established");
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
  requiredBranchAdminInitializer = ensureRequiredBranchAdminIndexes,
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
    await requiredBranchAdminInitializer();
  } catch (err) {
    err.code = err.code || "REQUIRED_BRANCH_ADMIN_INDEX_INITIALIZATION_FAILED";
    console.error("Required index initialization failed:", err.message);
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
  REQUIRED_BRANCH_ADMIN_POINTER_INDEX,
  REQUIRED_BRANCH_ADMIN_USER_INDEX,
  BRANCH_ADMIN_POINTER_INDEX_OPTIONS,
  BRANCH_ADMIN_USER_INDEX_OPTIONS,
  assertNoDuplicateBranchAdminPointers,
  assertNoDuplicateBranchAdmins,
  ensureIndexes,
  ensureOptionalIndexes,
  ensureRequiredBranchAdminIndexes,
  ensureRequiredTableIndexes,
  hasExactKey,
  isObsoleteGlobalTableNumberIndex,
  isRequiredTableIndex,
  listTableIndexes,
};
