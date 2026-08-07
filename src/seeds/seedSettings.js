const Settings = require("../models/settings");
const Branch = require("../models/Branch");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");

const DEFAULT_SETTINGS = {
  businessName: "My Restaurant",
  currency: "INR",
  timezone: "Asia/Kolkata",
};
async function seedSettings({ force = false, clean = false } = {}) {
  const branches = await Branch.find({});
  if (!branches.length)
    throw new Error("seedSettings requires at least one branch");
  const custom = jsonEnv("SEED_SETTINGS_JSON", []);
  const settings = branches.map((branch) => ({
    ...DEFAULT_SETTINGS,
    ...(custom.find((item) => item.branch === branch.name) || {}),
    branchId: branch._id,
  }));
  if (clean)
    await removeSeedRecords(
      settings.map(({ branchId }) => ({
        Model: Settings,
        filter: { branchId },
        label: "branch settings",
      })),
    );
  return Promise.all(
    settings.map((item) =>
      saveIfMissing(
        Settings,
        { branchId: item.branchId },
        item,
        `settings for ${item.businessName}`,
        { force },
      ),
    ),
  );
}

if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("settings", seedSettings, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedSettings };
