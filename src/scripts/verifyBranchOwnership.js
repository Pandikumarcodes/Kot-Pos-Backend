const {
  connectOwnershipDatabase,
  disconnectOwnershipDatabase,
  logOwnershipScriptError,
} = require("../config/ownershipDatabase");
const { COLLECTIONS, VERSION, normalizeBranchId } = require("./ownershipMigration");
const User = require("../models/users");
const Branch = require("../models/Branch");
const { parseArgs, atomicWriteJson } = require("./migrationCli");

const verifyCollection = async (Model, branchId, memberIds, tablesOnly = false) => {
  // Read the ownership field without a BSON-type-sensitive branch predicate.
  // Migration normalizes branch IDs to trimmed strings before writing; compare
  // the serialized values here so ObjectId and string representations agree.
  const records = await Model.find({}).select("_id createdBy branchId").lean();
  const targetBranchId = normalizeBranchId(branchId);
  const memberIdSet = new Set((memberIds || []).map((id) => String(id)));
  const direct = records.filter((record) =>
    record.branchId !== null &&
    record.branchId !== undefined &&
    record.branchId !== "" &&
    normalizeBranchId(record.branchId) === targetBranchId,
  );
  if (tablesOnly) return { directRecordCount: direct.length, legacyOnlyCount: 0, overlappingCount: 0, conflictingCount: 0, crossBranchMismatchCount: 0 };
  // Legacy ownership is the creator membership fallback. It intentionally
  // includes directly-owned records too, allowing overlap to be reported.
  const legacy = records.filter((record) => memberIdSet.has(String(record.createdBy)));
  const directIds = new Set(direct.map((item) => String(item._id)));
  const legacyIds = new Set(legacy.map((item) => String(item._id)));
  const conflictingIds = new Set(records.filter((record) =>
    record.branchId !== null &&
    record.branchId !== undefined &&
    record.branchId !== "" &&
    normalizeBranchId(record.branchId) !== targetBranchId &&
    memberIdSet.has(String(record.createdBy)),
  ).map((record) => String(record._id)));
  return {
    directRecordCount: direct.length,
    legacyOnlyCount: [...legacyIds].filter((id) => !directIds.has(id) && !conflictingIds.has(id)).length,
    overlappingCount: [...legacyIds].filter((id) => directIds.has(id)).length,
    conflictingCount: conflictingIds.size,
    crossBranchMismatchCount: conflictingIds.size,
  };
};

const main = async () => {
  const args = parseArgs();
  try {
    await connectOwnershipDatabase();
    const branches = await Branch.find({}).select("_id").lean();
    const report = { mode: "read-only", migrationVersion: VERSION, branches: {} };
    for (const branch of branches) {
      const branchId = String(branch._id);
      const users = await User.find({ branchId }).select("_id").lean();
      const memberIds = users.map((user) => user._id);
      report.branches[branchId] = {};
      for (const [name, Model] of Object.entries(COLLECTIONS)) {
        report.branches[branchId][name] = await verifyCollection(Model, branch._id, memberIds, name === "Table");
      }
    }
    if (args["report-file"]) atomicWriteJson(args["report-file"], report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectOwnershipDatabase();
  }
};

if (require.main === module) main().catch((error) => { logOwnershipScriptError(error); process.exitCode = 1; });
module.exports = { verifyCollection };
