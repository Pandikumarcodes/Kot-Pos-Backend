const Inventory = require("../models/Inventory");
const Branch = require("../models/Branch");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");

const DEFAULT_INVENTORY = [
  {
    name: "Paneer",
    unit: "kg",
    currentStock: 20,
    lowStockThreshold: 5,
    category: "dairy",
    costPerUnit: 280,
  },
];
async function seedInventory({ force = false, clean = false } = {}) {
  const items = jsonEnv("SEED_INVENTORY_JSON", DEFAULT_INVENTORY);
  const branches = await Branch.find({});
  if (!branches.length)
    throw new Error("seedInventory requires at least one branch");
  const records = branches.flatMap((branch) =>
    items.map((item) => ({ ...item, branchId: branch._id })),
  );
  if (clean)
    await removeSeedRecords(
      records.map(({ branchId, name }) => ({
        Model: Inventory,
        filter: { branchId, name },
        label: `inventory ${name}`,
      })),
    );
  return Promise.all(
    records.map((item) =>
      saveIfMissing(
        Inventory,
        { branchId: item.branchId, name: item.name },
        item,
        `inventory ${item.name}`,
        { force },
      ),
    ),
  );
}

if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("inventory", seedInventory, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedInventory };
