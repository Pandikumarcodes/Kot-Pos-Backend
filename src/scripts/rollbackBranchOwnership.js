const {
  connectOwnershipDatabase,
  disconnectOwnershipDatabase,
  logOwnershipScriptError,
} = require("../config/ownershipDatabase");
const { COLLECTIONS, VERSION, getCollection } = require("./ownershipMigration");
const { parseArgs, atomicWriteJson, readJson } = require("./migrationCli");

const rollbackRecords = async (report, models, apply = false) => {
  const results = [];
  for (const [collection, result] of Object.entries(report.collections || {})) {
    const Model = models[collection];
    for (const decision of result.decisions || []) {
      if (decision.decision !== "migrated" || !decision.candidateBranchId) continue;
      const entry = { collection, recordId: decision.recordId, migratedBranchId: decision.candidateBranchId, decision: apply ? "pending" : "would-unset", migrationVersion: VERSION };
      if (apply) {
        const update = await Model.updateOne({ _id: decision.recordId, branchId: decision.candidateBranchId }, { $unset: { branchId: 1 } });
        entry.decision = update.modifiedCount === 1 ? "unset" : "skipped-current-value-changed";
      }
      results.push(entry);
    }
  }
  return results;
};

const main = async () => {
  const args = parseArgs();
  const reportFile = args["report-file"] || args.report;
  if (!reportFile) throw new Error("--report-file from an applied backfill is required");
  const report = readJson(reportFile);
  const apply = args.apply === true;
  let results = [];
  try {
    await connectOwnershipDatabase();
    const models = Object.fromEntries(Object.entries(report.collections || {}).map(([collection]) => [getCollection(collection), COLLECTIONS[getCollection(collection)]]));
    results = await rollbackRecords(report, models, apply);
  } finally {
    await disconnectOwnershipDatabase();
  }
  const output = { mode: apply ? "apply" : "dry-run", migrationVersion: VERSION, results };
  if (args["output-file"]) atomicWriteJson(args["output-file"], output);
  console.log(JSON.stringify(output, null, 2));
};

if (require.main === module) main().catch((error) => { logOwnershipScriptError(error); process.exitCode = 1; });
module.exports = { main, rollbackRecords };
