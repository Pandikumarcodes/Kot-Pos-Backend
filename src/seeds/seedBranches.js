const Branch = require("../models/Branch");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");

const DEFAULT_BRANCHES = [
  { name: "Main Branch", address: "", phone: "", email: "", gstin: "" },
];
const branchData = () => jsonEnv("SEED_BRANCHES_JSON", DEFAULT_BRANCHES);

async function seedBranches({ force = false, clean = false } = {}) {
  const branches = branchData();
  if (clean)
    await removeSeedRecords(
      branches.map(({ name }) => ({
        Model: Branch,
        filter: { name },
        label: `branch ${name}`,
      })),
    );
  return Promise.all(
    branches.map((branch) =>
      saveIfMissing(
        Branch,
        { name: branch.name },
        branch,
        `branch ${branch.name}`,
        { force },
      ),
    ),
  );
}

if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("branches", seedBranches, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedBranches, branchData };
