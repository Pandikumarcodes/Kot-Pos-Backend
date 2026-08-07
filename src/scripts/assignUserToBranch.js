const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { connectDB } = require("../config/Database");
const User = require("../models/users");
const Branch = require("../models/Branch");

const BRANCH_SCOPED_ROLES = new Set([
  "cashier",
  "manager",
  "waiter",
  "chef",
]);

function parseArgs(argv) {
  const args = {};

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const separator = argument.indexOf("=");
    if (separator === -1) {
      args[argument.slice(2)] = true;
    } else {
      const key = argument.slice(2, separator);
      const value = argument.slice(separator + 1).trim();
      if (!value) throw new Error(`Missing value for --${key}`);
      args[key] = value;
    }
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node src/scripts/assignUserToBranch.js --list-branches",
    "  node src/scripts/assignUserToBranch.js --userId=<USER_ID> --branchId=<BRANCH_ID> --confirm",
    "  node src/scripts/assignUserToBranch.js --username=<USERNAME> --branchId=<BRANCH_ID> --confirm",
    "",
    "Mutation requires --confirm. The script changes only User.branchId.",
  ].join("\n");
}

function requireObjectId(value, optionName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`${optionName} must be a valid MongoDB ObjectId`);
  }
  return new mongoose.Types.ObjectId(value);
}

function safeErrorMessage(error) {
  let message = error?.message || "Unknown error";
  if (process.env.MONGO_URI) {
    message = message
      .split(process.env.MONGO_URI)
      .join("[redacted MongoDB URI]");
  }
  return message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted MongoDB URI]");
}

async function listBranches() {
  const branches = await Branch.find({})
    .select("_id name isActive")
    .sort({ name: 1 })
    .lean();

  if (branches.length === 0) {
    console.log("No branch records found.");
    return;
  }

  for (const branch of branches) {
    console.log(
      JSON.stringify({
        branchId: branch._id.toString(),
        name: branch.name,
        isActive: branch.isActive,
      }),
    );
  }
}

async function findUser(args) {
  if (args.userId && (args.username || args.email)) {
    throw new Error("Use --userId or --username/--email, not both");
  }

  if (args.email && !User.schema.path("email")) {
    throw new Error(
      "The User model has no email field; use --userId or --username",
    );
  }

  if (args.userId) {
    return User.findById(requireObjectId(args.userId, "--userId"))
      .select("_id username role branchId")
      .lean();
  }

  if (!args.username && !args.email) {
    throw new Error("Provide --userId, --username, or --email");
  }

  const filter = {};
  if (args.username) filter.username = args.username;
  if (args.email) filter.email = args.email;

  const users = await User.find(filter)
    .select("_id username role branchId")
    .limit(2)
    .lean();

  if (users.length > 1) {
    throw new Error(
      "User lookup is ambiguous; provide --userId or a more specific lookup",
    );
  }

  return users[0] || null;
}

async function assignUserToBranch(args) {
  if (!args.branchId) throw new Error("Missing required --branchId");

  const branchId = requireObjectId(args.branchId, "--branchId");
  const branch = await Branch.findById(branchId)
    .select("_id name isActive")
    .lean();

  if (!branch) throw new Error("Branch not found");
  if (branch.isActive === false) throw new Error("Branch is inactive");

  const user = await findUser(args);
  if (!user) throw new Error("User not found");
  if (!BRANCH_SCOPED_ROLES.has(user.role)) {
    throw new Error(`User role '${user.role}' is not branch-scoped`);
  }

  if (!args.confirm) {
    console.log(
      JSON.stringify({
        action: "preview",
        userId: user._id.toString(),
        username: user.username,
        role: user.role,
        assignedBranchId: branch._id.toString(),
        branchName: branch.name,
        currentBranchId: user.branchId ? user.branchId.toString() : null,
        note: "Re-run with --confirm to update only user.branchId.",
      }),
    );
    return;
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { branchId: branch._id } },
  );

  console.log(
    JSON.stringify({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      assignedBranchId: branch._id.toString(),
      branchName: branch.name,
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || Object.keys(args).length === 0) {
    console.log(usage());
    return;
  }

  if (!args["list-branches"]) {
    if (args.branchId) requireObjectId(args.branchId, "--branchId");
    if (args.userId) requireObjectId(args.userId, "--userId");
  }

  await connectDB();
  if (args["list-branches"]) {
    await listBranches();
  } else {
    await assignUserToBranch(args);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Assignment script failed: ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    });
}

module.exports = {
  BRANCH_SCOPED_ROLES,
  assignUserToBranch,
  findUser,
  listBranches,
  parseArgs,
  requireObjectId,
};
