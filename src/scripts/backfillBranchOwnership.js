const mongoose = require("mongoose");
const {
  connectOwnershipDatabase,
  disconnectOwnershipDatabase,
  logOwnershipScriptError,
} = require("../config/ownershipDatabase");
const Branch = require("../models/Branch");
const { COLLECTIONS, resolveOwnership, chooseTableAssignment, validateBranch, parseTableMap, parseTakeAwayMap, getCollection, VERSION, safeErrorMessage } = require("./ownershipMigration");
const { parseArgs, atomicWriteJson, readJson, summarize } = require("./migrationCli");

const DEFAULT_BATCH_SIZE = 250;

const persistBranchOwnership = async (Model, recordId, candidateBranchId) => {
  const normalizedCandidate = String(candidateBranchId).trim();
  const branchValue = new mongoose.Types.ObjectId(normalizedCandidate);
  const filter = {
    _id: recordId,
    $or: [{ branchId: { $exists: false } }, { branchId: null }],
  };
  // Native collection access is deliberately scoped to this migration. It
  // bypasses Mongoose's immutable-path update stripping while production
  // application writes continue to use the immutable model schema.
  const result = await Model.collection.updateOne(
    filter,
    { $set: { branchId: branchValue } },
  );
  const diagnostic = {
    recordId: String(recordId),
    collection: Model.collection.name,
    candidateBranchId: normalizedCandidate,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    acknowledged: result.acknowledged,
  };
  if (!result.acknowledged) return { decision: "error", diagnostic };
  if (result.matchedCount === 0) return { decision: "write-not-matched", diagnostic };
  if (result.modifiedCount === 0) return { decision: "write-not-modified", diagnostic };

  const persisted = await Model.collection.findOne(
    { _id: recordId },
    { projection: { _id: 1, branchId: 1 } },
  );
  const persistedBranchId = persisted?.branchId == null
    ? null
    : String(persisted.branchId).trim();
  diagnostic.persistedBranchId = persistedBranchId;
  if (!persisted || persistedBranchId !== normalizedCandidate)
    return { decision: "persistence-verification-failed", diagnostic };
  return { decision: "migrated", diagnostic };
};

const createCheckpoint = (collection, existing = {}) => ({
  migrationVersion: VERSION,
  collection,
  lastProcessedId: existing.lastProcessedId || null,
  scannedCount: existing.scannedCount || 0,
  migratedCount: existing.migratedCount || 0,
  skippedCount: existing.skippedCount || 0,
  conflictCount: existing.conflictCount || 0,
  unresolvedCount: existing.unresolvedCount || 0,
  errorCount: existing.errorCount || 0,
  startedAt: existing.startedAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const updateCheckpoint = (checkpoint, decision) => {
  checkpoint.scannedCount += 1;
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.lastProcessedId = decision.recordId;
  if (decision.decision === "migrated") checkpoint.migratedCount += 1;
  if (["skipped", "already-owned", "invalid", "orphaned"].includes(decision.decision)) checkpoint.skippedCount += 1;
  if (decision.decision === "conflicting") checkpoint.conflictCount += 1;
  if (decision.decision === "unresolved") checkpoint.unresolvedCount += 1;
  if (decision.decision === "failed") checkpoint.errorCount += 1;
};

const migrateCollection = async (collection, Model, options) => {
  const prior = options.resume && options.checkpoint?.collections?.[collection];
  const checkpoint = createCheckpoint(collection, prior);
  const query = prior?.lastProcessedId && options.resume
    ? { _id: { $gt: prior.lastProcessedId } }
    : {};
  const decisions = [];
  const matchedTakeAwayMapIds = new Set();
  const cursor = Model.find(query).sort({ _id: 1 }).lean().cursor({ batchSize: options.batchSize });
  for await (const record of cursor) {
    if (collection === "TakeAway" && Object.prototype.hasOwnProperty.call(options.takeawayMap || {}, String(record._id))) {
      matchedTakeAwayMapIds.add(String(record._id));
    }
    let decision;
    try {
      const migrationContext = options.context || {};
      decision = await resolveOwnership(record, collection, {
        ...migrationContext,
        tableMap: options.tableMap,
        takeawayMap: options.takeawayMap,
      });
      decision = await chooseTableAssignment(decision, options, {
        ...migrationContext,
        findBranch: migrationContext.findBranch || ((branchId) => Branch.exists({ _id: branchId })),
      });
      if (decision.decision === "safe-to-migrate") {
        const validation = await validateBranch(decision.candidateBranchId, migrationContext);
        if (!validation.ok) {
          decision = { ...decision, decision: "invalid", reason: validation.error };
        } else if (options.apply) {
          const persistence = await persistBranchOwnership(
            Model,
            record._id,
            decision.candidateBranchId,
          );
          if (persistence.decision === "migrated") {
            decision = { ...decision, decision: "migrated", previousBranchId: null, appliedAt: new Date().toISOString(), migrationVersion: VERSION, write: persistence.diagnostic };
          } else {
            decision = { ...decision, decision: persistence.decision, reason: "guarded branchId write was not verified", write: persistence.diagnostic };
          }
        }
      }
    } catch (error) {
      decision = { collection, recordId: String(record._id), decision: "failed", reason: "migration evaluation failed", error: { name: error.name, code: error.code, message: safeErrorMessage(error) } };
    }
    decisions.push(decision);
    updateCheckpoint(checkpoint, decision);
    if (options.checkpointFile) {
      const state = options.checkpoint || { migrationVersion: VERSION, collections: {} };
      state.collections[collection] = checkpoint;
      atomicWriteJson(options.checkpointFile, state);
    }
  }
  if (collection === "TakeAway") {
    const unknownIds = Object.keys(options.takeawayMap || {}).filter((id) => !matchedTakeAwayMapIds.has(id));
    if (unknownIds.length) throw new Error(`takeaway map references nonexistent record: ${unknownIds[0]}`);
  }
  return { checkpoint, summary: summarize(decisions), decisions };
};

const main = async () => {
  const args = parseArgs();
  const apply = args.apply === true;
  const batchSize = Math.max(1, Number(args["batch-size"] || DEFAULT_BATCH_SIZE));
  try {
    const tableMap = parseTableMap(args["table-map"]);
    const takeawayMap = parseTakeAwayMap(args["takeaway-map"]);
    if (args["default-branch-id"] && !args["confirm-default-assignment"] && apply) throw new Error("--default-branch-id in apply mode requires --confirm-default-assignment");
    await connectOwnershipDatabase();
    const names = args.collection ? [getCollection(args.collection)] : Object.keys(COLLECTIONS);
    const state = readJson(args["checkpoint-file"], { migrationVersion: VERSION, collections: {} });
    const report = { mode: apply ? "apply" : "dry-run", migrationVersion: VERSION, writes: 0, collections: {} };
    const options = {
      apply, batchSize, checkpointFile: args["checkpoint-file"], checkpoint: state, resume: args.resume === true,
      tableMap, takeawayMap, defaultBranchId: args["default-branch-id"], confirmDefaultAssignment: args["confirm-default-assignment"] === true,
    };
    for (const name of names) report.collections[name] = await migrateCollection(name, COLLECTIONS[name], options);
    report.writes = apply
      ? Object.values(report.collections).reduce(
          (sum, item) => sum + (item.summary.migrated || 0),
          0,
        )
      : 0;
    if (args["report-file"]) atomicWriteJson(args["report-file"], report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectOwnershipDatabase();
  }
};

if (require.main === module) main().catch((error) => { logOwnershipScriptError(error); process.exitCode = 1; });
module.exports = { createCheckpoint, updateCheckpoint, migrateCollection, persistBranchOwnership };
