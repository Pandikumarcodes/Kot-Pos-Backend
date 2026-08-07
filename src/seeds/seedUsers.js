const User = require("../models/users");
const Branch = require("../models/Branch");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");

const DEFAULT_USERS = [];
function userData() {
  return jsonEnv("SEED_USERS_JSON", DEFAULT_USERS);
}

async function seedUsers({ force = false, clean = false } = {}) {
  const users = userData();
  if (!users.length) return [];
  const branches = await Branch.find({
    name: { $in: users.map((user) => user.branch) },
  });
  const byName = new Map(branches.map((branch) => [branch.name, branch._id]));
  const resolved = users.map((user) => ({
    ...user,
    branchId: user.branch ? byName.get(user.branch) : null,
  }));
  if (resolved.some((user) => user.branch && !user.branchId))
    throw new Error("SEED_USERS_JSON references a missing branch");
  if (clean)
    await removeSeedRecords(
      resolved.map(({ username }) => ({
        Model: User,
        filter: { username },
        label: `user ${username}`,
      })),
    );
  return Promise.all(
    resolved.map(({ branch, ...user }) =>
      saveIfMissing(
        User,
        { username: user.username },
        user,
        `user ${user.username}`,
        { force },
      ),
    ),
  );
}

if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("users", seedUsers, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedUsers, userData };
