const { executeSeed, runSeed } = require("./utils");
const { seedSuperAdmin } = require("./seedSuperAdmin");
const { seedBranches } = require("./seedBranches");
const { seedUsers } = require("./seedUsers");
const { seedSettings } = require("./seedSettings");
const { seedMenu } = require("./seedMenu");
const { seedInventory } = require("./seedInventory");
const { seedTables } = require("./seedTables");
const { seedCustomers } = require("./seedCustomers");

async function seedAll(options = {}) {
  await runSeed("super admin", seedSuperAdmin, options);
  if (options.adminOnly) return;
  await runSeed("branches", seedBranches, options);
  await runSeed("users", seedUsers, options);
  await runSeed("settings", seedSettings, options);
  await runSeed("menu", seedMenu, options);
  await runSeed("inventory", seedInventory, options);
  await runSeed("tables", seedTables, options);
  await runSeed("customers", seedCustomers, options);
}

if (require.main === module)
  executeSeed(seedAll).then((code) => (process.exitCode = code));
module.exports = { seedAll };
