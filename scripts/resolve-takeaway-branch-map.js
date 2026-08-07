const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
const TakeAway = require("../src/models/takeAway");
const User = require("../src/models/users");
const Kot = require("../src/models/kot");
const TableOrder = require("../src/models/waiter");
const Billing = require("../src/models/billings");
const AuditEvent = require("../src/models/AuditEvent");
const Branch = require("../src/models/Branch");

const root = path.resolve(__dirname, "..");
const templatePath = path.join(root, "takeaway-branch-map.template.json");
const suggestedPath = path.join(root, "takeaway-branch-map.suggested.json");
const reportPath = path.join(root, "docs", "phase5B-takeaway-auto-resolution.md");

const idString = (value) => (value == null ? null : String(value));
const validObjectId = (value) => mongoose.isValidObjectId(value);

const collectExactMatches = (value, target, field = "", result = []) => {
  if (value == null) return result;
  if (value instanceof mongoose.Types.ObjectId || typeof value !== "object") {
    if (idString(value) === target) result.push(field || "<root>");
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectExactMatches(item, target, `${field}[${index}]`, result));
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    collectExactMatches(child, target, field ? `${field}.${key}` : key, result);
  }
  return result;
};

const unique = (values) => [...new Set(values.filter(Boolean))];
const branchEvidence = (source, branchId, recordId, details = {}) => ({
  source,
  branchId: idString(branchId),
  recordId: idString(recordId),
  ...details,
});

const findLinked = (records, takeawayId, collection) => records
  .filter((record) => collectExactMatches(record, takeawayId).length)
  .map((record) => ({
    collection,
    id: idString(record._id),
    branchId: idString(record.branchId),
    matchingFields: collectExactMatches(record, takeawayId),
    createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
  }));

const main = async () => {
  const ids = Object.keys(JSON.parse(fs.readFileSync(templatePath, "utf8")));
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000, connectTimeoutMS: 30000 });
  try {
    const [takeaways, kots, orders, billings, audits, branches] = await Promise.all([
      TakeAway.find({ _id: { $in: ids } }).lean(),
      Kot.find({}).lean(),
      TableOrder.find({}).lean(),
      Billing.find({}).lean(),
      AuditEvent.find({ entityType: { $in: ["TAKEAWAY", "TakeAway", "ORDER", "KOT", "BILLING"] } }).lean(),
      Branch.find({}).select("_id").lean(),
    ]);
    const takeawayById = new Map(takeaways.map((record) => [idString(record._id), record]));
    const branchIds = new Set(branches.map((branch) => idString(branch._id)));
    const results = [];
    for (const takeawayId of ids) {
      const record = takeawayById.get(takeawayId);
      const creator = record?.createdBy ? await User.findById(record.createdBy).select("_id branchId").lean() : null;
      const linked = [
        ...findLinked(kots, takeawayId, "KOT"),
        ...findLinked(orders, takeawayId, "order"),
        ...findLinked(billings, takeawayId, "billing"),
      ];
      const auditMatches = audits.filter((event) => event.entityId === takeawayId || collectExactMatches(event, takeawayId).length);
      const evidence = [];
      if (record?.branchId != null) evidence.push(branchEvidence("direct TakeAway.branchId", record.branchId, takeawayId));
      if (creator?.branchId != null) evidence.push(branchEvidence("creator.branchId", creator.branchId, creator._id));
      for (const item of linked) if (item.branchId != null) evidence.push(branchEvidence(`${item.collection}.branchId`, item.branchId, item.id, { matchingFields: item.matchingFields }));
      for (const event of auditMatches) if (event.branchId != null) evidence.push(branchEvidence("audit.branchId", event.branchId, event._id, { entityType: event.entityType, action: event.action, timestamp: event.timestamp }));
      const validEvidence = evidence.filter((item) => validObjectId(item.branchId) && branchIds.has(item.branchId));
      const invalidEvidence = evidence.filter((item) => !validObjectId(item.branchId) || !branchIds.has(item.branchId));
      const candidateBranches = unique(validEvidence.map((item) => item.branchId));
      const decision = candidateBranches.length > 1 ? "conflict" : candidateBranches.length === 1 ? "safe-to-map" : "unresolved";
      results.push({
        takeawayId,
        status: record?.status ?? null,
        createdAt: record?.createdAt ? new Date(record.createdAt).toISOString() : null,
        createdBy: idString(record?.createdBy),
        creatorBranchId: idString(creator?.branchId),
        linkedEvidence: { kots: findLinked(kots, takeawayId, "KOT"), orders: findLinked(orders, takeawayId, "order"), billings: findLinked(billings, takeawayId, "billing"), audits: auditMatches.map((event) => ({ id: idString(event._id), entityType: event.entityType, entityId: event.entityId, branchId: idString(event.branchId), action: event.action, timestamp: event.timestamp })) },
        evidence,
        invalidEvidence,
        candidateBranchId: candidateBranches.length === 1 ? candidateBranches[0] : null,
        evidenceSources: validEvidence.map((item) => item.source),
        decision,
      });
    }
    const suggested = Object.fromEntries(results.filter((item) => item.decision === "safe-to-map").map((item) => [item.takeawayId, item.candidateBranchId]));
    fs.writeFileSync(suggestedPath, `${JSON.stringify(suggested, null, 2)}\n`);
    const safe = results.filter((item) => item.decision === "safe-to-map");
    const conflicts = results.filter((item) => item.decision === "conflict");
    const unresolved = results.filter((item) => item.decision === "unresolved");
    const detail = results.map((item) => {
      const linked = ["kots", "orders", "billings"].flatMap((key) => item.linkedEvidence[key].map((entry) => `${entry.collection}:${entry.id} branch=${entry.branchId ?? "null"} fields=${entry.matchingFields.join(",")}`));
      const audits = item.linkedEvidence.audits.map((entry) => `audit:${entry.id} entity=${entry.entityType}/${entry.entityId} branch=${entry.branchId ?? "null"}`);
      return `### ${item.takeawayId}\n\n- Status: ${item.status ?? "record not found"}\n- Created at: ${item.createdAt ?? "unknown"}\n- Created by: ${item.createdBy ?? "null"}\n- Creator branch: ${item.creatorBranchId ?? "null"}\n- Candidate branch: ${item.candidateBranchId ?? "null"}\n- Evidence sources: ${item.evidenceSources.length ? item.evidenceSources.join(", ") : "none"}\n- Decision: **${item.decision}**\n- Linked evidence: ${[...linked, ...audits].join("; ") || "none"}\n- Branch validation: ${item.invalidEvidence.length ? `invalid/nonexistent evidence ignored (${item.invalidEvidence.map((entry) => `${entry.source}=${entry.branchId}`).join(", ")})` : "all candidate evidence uses an existing valid ObjectId branch"}`;
    }).join("\n\n");
    const manual = [...conflicts, ...unresolved].map((item) => `- ${item.takeawayId} (${item.decision})`).join("\n") || "- None";
    const report = `# Phase 5B TakeAway automatic resolution\n\nGenerated: ${new Date().toISOString()}\n\nRead-only inspection of all IDs in takeaway-branch-map.template.json. No database writes were performed and --apply was not executed.\n\n## Summary\n\n- Total records inspected: **${results.length}**\n- Safe-to-map: **${safe.length}**\n- Conflicts: **${conflicts.length}**\n- Unresolved: **${unresolved.length}**\n\n## Evidence and decisions\n\nEvidence priority: direct TakeAway branch, creator branch, linked KOT branch, linked order branch, linked billing branch, audit branch. A candidate was emitted only when exactly one valid existing Branch ID was supported.\n\n${detail}\n\n## Manual review\n\n${manual}\n\n## Suggested map\n\nGenerated file: takeaway-branch-map.suggested.json. It contains safe-to-map records only.\n\n## Final dry-run command\n\ntilde~tilde~tilde powershell\nnpm run ownership:backfill -- --dry-run --table-map=table-branch-map.completed.json --takeaway-map=takeaway-branch-map.suggested.json --report-file=ownership-backfill-dry-run-takeaway-suggested.json --checkpoint-file=ownership.checkpoint.takeaway-suggested.json\ntilde~tilde~tilde\n`;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);
    console.log(JSON.stringify({ total: results.length, safeToMap: safe.length, conflicts: conflicts.length, unresolved: unresolved.length, manualReview: [...conflicts, ...unresolved].map((item) => item.takeawayId), suggestedPath, reportPath, results }, null, 2));
  } finally { await mongoose.disconnect(); }
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
