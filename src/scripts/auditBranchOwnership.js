const mongoose = require("mongoose");
const {
  connectOwnershipDatabase,
  disconnectOwnershipDatabase,
  logOwnershipScriptError,
} = require("../config/ownershipDatabase");
const {
  COLLECTIONS,
  resolveOwnership,
  chooseTableAssignment,
  validateBranch,
  parseTableMap,
  getCollection,
  VERSION,
} = require("./ownershipMigration");
const {
  parseArgs,
  atomicWriteJson,
  summarize,
} = require("./migrationCli");

const auditCollection = async (collectionName, Model, options = {}) => {
  const decisions = [];
  const cursor = Model.find({}).sort({ _id: 1 }).lean().cursor();
  for await (const record of cursor) {
    let decision = await resolveOwnership(record, collectionName, {
      tableMap: options.tableMap,
    });
    decision = await chooseTableAssignment(decision, options, {
      findBranch: (branchId) =>
        mongoose.model("Branch").exists({ _id: branchId }),
    });
    if (decision.candidateBranchId && decision.decision === "safe-to-migrate") {
      const validation = await validateBranch(decision.candidateBranchId, {
        findBranch: (branchId) =>
          mongoose.model("Branch").exists({ _id: branchId }),
      });
      if (!validation.ok)
        decision = {
          ...decision,
          decision: "invalid",
          reason: validation.error,
        };
    }
    decisions.push(decision);
  }
  return { summary: summarize(decisions), decisions };
};

const main = async () => {
  const args = parseArgs();
  const collectionNames = args.collection
    ? [getCollection(args.collection)]
    : Object.keys(COLLECTIONS);
  try {
    await connectOwnershipDatabase();
    const report = {
      mode: "dry-run",
      migrationVersion: VERSION,
      writes: 0,
      collections: {},
    };
    const options = {
      tableMap: parseTableMap(args["table-map"]),
      defaultBranchId: args["default-branch-id"],
      confirmDefaultAssignment: args["confirm-default-assignment"] === true,
    };
    for (const name of collectionNames)
      report.collections[name] = await auditCollection(
        name,
        COLLECTIONS[name],
        options,
      );
    if (args["report-file"]) atomicWriteJson(args["report-file"], report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectOwnershipDatabase();
  }
};

if (require.main === module)
  main().catch((error) => {
    logOwnershipScriptError(error);
    process.exitCode = 1;
  });
module.exports = { auditCollection };
