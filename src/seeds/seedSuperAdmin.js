const User = require("../models/users");
const {
  log,
  requiredEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
  executeSeed,
} = require("./utils");

const ADMIN_USERNAME = () => process.env.SEED_ADMIN_USERNAME?.trim() || "admin";
const adminFilter = () => ({ username: ADMIN_USERNAME() });

async function seedSuperAdmin({ force = false, clean = false } = {}) {
  if (clean)
    await removeSeedRecords([
      { Model: User, filter: adminFilter(), label: "seed admin user(s)" },
    ]);
  const password = requiredEnv("SEED_ADMIN_PASSWORD", "SUPERADMIN_PASSWORD");
  const { document } = await saveIfMissing(
    User,
    adminFilter(),
    {
      username: ADMIN_USERNAME(),
      password,
      role: "admin",
      status: "active",
      branchId: null,
    },
    `super admin ${ADMIN_USERNAME()}`,
    { force },
  );
  log.info("super admin ready", { username: document.username });
  return document;
}

if (require.main === module) {
  executeSeed((options) =>
    runSeed("super admin", seedSuperAdmin, options),
  ).then((code) => (process.exitCode = code));
}

module.exports = { seedSuperAdmin, ADMIN_USERNAME, adminFilter };
