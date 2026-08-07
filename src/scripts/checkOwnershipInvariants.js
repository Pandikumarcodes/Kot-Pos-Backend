const mongoose = require("mongoose");
const Billing = require("../models/billings");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const TakeAway = require("../models/takeAway");
const Inventory = require("../models/Inventory");
const Kot = require("../models/kot");
const StockLog = require("../models/StockLog");
const Branch = require("../models/Branch");
const {
  connectOwnershipDatabase,
  disconnectOwnershipDatabase,
  logOwnershipScriptError,
} = require("../config/ownershipDatabase");

const PHASE5D_CUTOFF = process.env.PHASE5D_ENFORCEMENT_CUTOFF
  ? new Date(process.env.PHASE5D_ENFORCEMENT_CUTOFF)
  : null;
const models = { Table, TableOrder, TakeAway, Inventory, KOT: Kot, StockLog, Billing };
const missing = (value) => value === undefined || value === null || value === "";
const id = (value) => (value == null ? null : String(value));
const isCompletedBilling = (record) => ["paid", "completed"].includes(String(record.paymentStatus || record.status || "").toLowerCase());
const isHistoricalBilling = (record) => isCompletedBilling(record) && (!PHASE5D_CUTOFF || !record.createdAt || new Date(record.createdAt) < PHASE5D_CUTOFF);
const violation = (type, entityType, record, details = {}) => ({
  type, entityType, entityId: id(record?._id), ...details,
});
const getExitCode = (report) => report.violations.length ? 1 : 0;

async function read(Model, projection = null) {
  const timeout = Number(process.env.MONGO_TIMEOUT_MS || process.env.MONGO_TIMEOUT) || 5000;
  const query = Model.find({}).select(projection || "_id branchId createdAt updatedAt status paymentStatus tableId kotId orderId billingId inventoryId").maxTimeMS(Math.min(timeout, 30000)).lean();
  return query;
}

const relationshipChecks = Object.freeze([
  ["TableOrder", "tableId", "Table"], ["TableOrder", "kotId", "KOT"], ["TableOrder", "billingId", "Billing"],
  ["TakeAway", "kotId", "KOT"], ["Billing", "tableId", "Table"], ["StockLog", "inventoryId", "Inventory"],
]);

async function checkOwnershipInvariants({ modelMap = models, branchModel = Branch, cutoff = PHASE5D_CUTOFF, readModel = read } = {}) {
  const collections = {};
  const violations = [];
  const warnings = [];
  for (const [name, Model] of Object.entries(modelMap)) {
    const records = await readModel(Model);
    collections[name] = records.length;
    for (const record of records) {
      if (missing(record.branchId)) {
        if (name === "Billing" && isCompletedBilling(record) && (!cutoff || !record.createdAt || new Date(record.createdAt) < cutoff)) {
          warnings.push(violation("historical-branchless-billing", name, record));
        } else {
          violations.push(violation(name === "Billing" ? "new-billing-without-branch" : `${name.toLowerCase()}-without-branchId`, name, record));
        }
      }
    }
  }

  const branches = await readModel(branchModel, "_id");
  const branchIds = new Set(branches.map((branch) => id(branch._id)));
  for (const [name, Model] of Object.entries(modelMap)) {
    const records = await readModel(Model);
    for (const record of records) if (!missing(record.branchId) && !branchIds.has(id(record.branchId))) {
      violations.push(violation("orphaned-branch-reference", name, record, { branchId: id(record.branchId) }));
    }
  }

  for (const [source, field, target] of relationshipChecks) {
    if (!modelMap[source] || !modelMap[target]) continue;
    const sourceRecords = await readModel(modelMap[source]);
    const targetRecords = await readModel(modelMap[target]);
    const targetById = new Map(targetRecords.map((record) => [id(record._id), record]));
    for (const record of sourceRecords) {
      const linked = record[field] && targetById.get(id(record[field]));
      if (linked && !missing(record.branchId) && !missing(linked.branchId) && id(record.branchId) !== id(linked.branchId)) {
        violations.push(violation("cross-branch-linked-resource", source, record, {
          relation: field, relatedEntityType: target, relatedEntityId: id(linked._id),
          expectedBranch: id(record.branchId), actualBranch: id(linked.branchId),
        }));
      }
    }
  }
  return { checkedAt: new Date().toISOString(), status: violations.length ? "critical" : warnings.length ? "warning" : "clean", collections, violations, warnings };
}

async function main() {
  const timeout = Math.min(Number(process.env.MONGO_TIMEOUT_MS || process.env.MONGO_TIMEOUT) || 5000, 30000);
  const bounded = (promise, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => {
    const error = new Error(`${label} timed out after ${timeout}ms`);
    error.code = "OWNERSHIP_BOUND_TIMEOUT";
    reject(error);
  }, timeout + 1000))]);
  let executionFailure = false;
  let phase = "connection";
  try {
    await bounded(connectOwnershipDatabase(), "database connection");
    phase = "invariant-check";
    const report = await bounded(checkOwnershipInvariants(), "invariant check");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = getExitCode(report);
  } catch (error) {
    executionFailure = true;
    logOwnershipScriptError(error, { phase });
    process.exitCode = 2;
  }
  finally { await Promise.race([disconnectOwnershipDatabase(), new Promise((resolve) => setTimeout(resolve, 500))]); }
  if (executionFailure) process.exit(2);
}
if (require.main === module) main();
module.exports = { checkOwnershipInvariants, isHistoricalBilling, relationshipChecks, getExitCode };
