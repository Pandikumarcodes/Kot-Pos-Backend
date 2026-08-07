const mongoose = require("mongoose");
const { resolveOwnership, chooseTableAssignment, validateBranch } = require("../scripts/ownershipMigration");
const { parseTableMap, parseTakeAwayMap } = require("../scripts/ownershipMigration");
const { migrateCollection, persistBranchOwnership } = require("../scripts/backfillBranchOwnership");
const { rollbackRecords } = require("../scripts/rollbackBranchOwnership");
const { verifyCollection } = require("../scripts/verifyBranchOwnership");
const Billing = require("../models/billings");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const TakeAway = require("../models/takeAway");

const id = () => new mongoose.Types.ObjectId();
const branchA = id();
const branchB = id();

const contextFor = (records) => ({
  findOne: async (Model, filter) => records.find((item) => String(item._id) === String(filter._id)) || null,
  findBranch: async (branchId) => String(branchId) === String(branchA),
  findAudit: async () => null,
});

const verificationModel = (records) => ({
  find: () => ({
    select: () => ({ lean: async () => records }),
  }),
});

describe("Phase 5B ownership migration tooling", () => {
  test("exports and parses table maps with safe error handling", () => {
    const ownershipMigration = require("../scripts/ownershipMigration");
    expect(typeof ownershipMigration.parseTableMap).toBe("function");
    expect(ownershipMigration.parseTableMap()).toEqual({});

    const tableId = id().toString();
    const branchId = branchA.toString();
    const fsImpl = { readFileSync: () => JSON.stringify({ [tableId]: branchId }) };
    expect(ownershipMigration.parseTableMap("table-map.json", fsImpl)).toEqual({
      [tableId]: branchId,
    });
    expect(() => ownershipMigration.parseTableMap("broken.json", {
      readFileSync: () => "{malformed",
    })).toThrow(SyntaxError);
  });

  test("resolves a single creator candidate", async () => {
    const creator = { _id: id(), branchId: branchA };
    const result = await resolveOwnership({ _id: id(), createdBy: creator._id }, "TakeAway", contextFor([creator]));
    expect(result.decision).toBe("safe-to-migrate");
    expect(result.candidateBranchId).toBe(String(branchA));
  });

  test("valid mapped TakeAway becomes safe-to-migrate with manual evidence", async () => {
    const record = { _id: id(), createdBy: id(), branchId: null };
    const result = await resolveOwnership(record, "TakeAway", {
      ...contextFor([]),
      takeawayMap: { [String(record._id)]: String(branchA) },
    });
    expect(result.decision).toBe("safe-to-migrate");
    expect(result.evidence).toContainEqual({
      source: "takeaway-map", branchId: String(branchA), referencedIds: [String(record._id)],
    });
  });

  test("missing TakeAway map entry remains unresolved", async () => {
    const result = await resolveOwnership({ _id: id(), branchId: null }, "TakeAway", {
      ...contextFor([]), takeawayMap: {},
    });
    expect(result.decision).toBe("unresolved");
  });

  test("rejects invalid TakeAway map identifiers and nonexistent branches", async () => {
    expect(() => parseTakeAwayMap("unused", { readFileSync: () => '{"bad":"branch"}' }))
      .toThrow("invalid takeaway mapping");
    const record = { _id: id(), branchId: null };
    const result = await resolveOwnership(record, "TakeAway", {
      ...contextFor([]), takeawayMap: { [String(record._id)]: String(branchB) },
    });
    expect(result.decision).toBe("invalid");
    expect(result.reason).toMatch(/branch does not exist/);
  });

  test("normalizes branch IDs and uses the same ObjectId validation for TakeAway and table maps", async () => {
    const record = { _id: id(), branchId: null };
    const table = { _id: id(), branchId: null };
    const seen = [];
    const findBranch = async (branchId) => {
      seen.push(branchId);
      return String(branchId) === String(branchA);
    };
    const takeaway = await resolveOwnership(record, "TakeAway", {
      findOne: async () => null,
      findBranch,
      findAudit: async () => null,
      takeawayMap: { [String(record._id)]: `  ${String(branchA)}  ` },
    });
    const tableOrder = await resolveOwnership({ _id: id(), tableId: table._id }, "TableOrder", {
      ...contextFor([table]),
      findBranch,
      tableMap: { [String(table._id)]: `  ${String(branchA)}  ` },
    });
    expect(takeaway.decision).toBe("safe-to-migrate");
    expect(tableOrder.decision).toBe("safe-to-migrate");
    expect(seen).toHaveLength(2);
    expect(seen.every((value) => value instanceof mongoose.Types.ObjectId)).toBe(true);
    expect(seen.map(String)).toEqual([String(branchA), String(branchA)]);
    await expect(validateBranch(String(branchB), { findBranch: async () => false }))
      .resolves.toEqual({ ok: false, error: "branch does not exist" });
  });

  test("conflicting TakeAway evidence remains conflict", async () => {
    const creator = { _id: id(), branchId: branchB };
    const record = { _id: id(), createdBy: creator._id, branchId: null };
    const result = await resolveOwnership(record, "TakeAway", {
      ...contextFor([creator]), takeawayMap: { [String(record._id)]: String(branchA) },
    });
    expect(result.decision).toBe("conflicting");
  });

  test("direct TakeAway branch differing from map is conflict", async () => {
    const record = { _id: id(), branchId: branchB };
    const result = await resolveOwnership(record, "TakeAway", {
      ...contextFor([]), takeawayMap: { [String(record._id)]: String(branchA) },
    });
    expect(result.decision).toBe("conflicting");
  });

  test("does not choose conflicting table and creator evidence", async () => {
    const table = { _id: id(), branchId: branchA };
    const creator = { _id: id(), branchId: branchB };
    const result = await resolveOwnership({ _id: id(), tableId: table._id, createdBy: creator._id }, "TableOrder", contextFor([table, creator]));
    expect(result.decision).toBe("conflicting");
    expect(result.conflicts.length).toBeGreaterThan(1);
  });

  test("propagates an approved table map to linked TableOrder records", async () => {
    const table = { _id: id(), branchId: null };
    const order = { _id: id(), tableId: table._id, branchId: null };
    const result = await resolveOwnership(order, "TableOrder", {
      ...contextFor([table]),
      tableMap: { [String(table._id)]: String(branchA) },
    });
    expect(result.decision).toBe("safe-to-migrate");
    expect(result.candidateBranchId).toBe(String(branchA));
    expect(result.evidence).toContainEqual({
      source: "table-map",
      branchId: String(branchA),
      referencedIds: [String(table._id)],
    });
  });

  test("propagates one mapped table to multiple TableOrders", async () => {
    const table = { _id: id(), branchId: null };
    const tableMap = { [String(table._id)]: String(branchA) };
    const results = await Promise.all([
      resolveOwnership({ _id: id(), tableId: table._id }, "TableOrder", {
        ...contextFor([table]), tableMap,
      }),
      resolveOwnership({ _id: id(), tableId: table._id }, "TableOrder", {
        ...contextFor([table]), tableMap,
      }),
    ]);
    expect(results.map((result) => result.decision)).toEqual([
      "safe-to-migrate",
      "safe-to-migrate",
    ]);
  });

  test("leaves an unmapped table unresolved", async () => {
    const table = { _id: id(), branchId: null };
    const result = await resolveOwnership(
      { _id: id(), tableId: table._id },
      "TableOrder",
      contextFor([table]),
    );
    expect(result.decision).toBe("unresolved");
    expect(result.evidence).toEqual([]);
  });

  test("rejects a nonexistent branch in a table map", async () => {
    const table = { _id: id(), branchId: null };
    const result = await resolveOwnership(
      { _id: id(), tableId: table._id },
      "TableOrder",
      {
        ...contextFor([table]),
        tableMap: { [String(table._id)]: String(branchB) },
      },
    );
    expect(result.decision).toBe("invalid");
    expect(result.reason).toMatch(/branch does not exist/);
  });

  test("conflicts when stored table branch differs from the table map", async () => {
    const table = { _id: id(), branchId: branchB };
    const result = await resolveOwnership(
      { _id: id(), tableId: table._id },
      "TableOrder",
      {
        ...contextFor([table]),
        tableMap: { [String(table._id)]: String(branchA) },
      },
    );
    expect(result.decision).toBe("conflicting");
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "table.branchId", branchId: String(branchB) }),
      expect.objectContaining({ source: "table-map", branchId: String(branchA) }),
    ]));
  });

  test("table mappings are explicit and defaults require confirmation", async () => {
    const tableId = id();
    const unresolved = { collection: "Table", recordId: String(tableId), decision: "unresolved", evidence: [], conflicts: [] };
    const skipped = await chooseTableAssignment(unresolved, { defaultBranchId: branchA }, { findBranch: async () => true });
    expect(skipped.decision).toBe("skipped");
    const mapped = await chooseTableAssignment(unresolved, { tableMap: { [tableId]: branchA } }, { findBranch: async () => true });
    expect(mapped.decision).toBe("safe-to-migrate");
    expect(mapped.reason).toBe("table-map");
  });

  test("table map rejects malformed identifiers", () => {
    expect(() => parseTableMap("unused", { readFileSync: () => "{\"bad\":\"branch\"}" })).toThrow("invalid table mapping");
  });

  test("dry-run migration performs no writes and apply is idempotent", async () => {
    const record = { _id: id(), createdBy: id(), branchId: null };
    const creator = { _id: record.createdBy, branchId: branchA };
    const state = { collections: {} };
    const updates = [];
    const cursor = {
      async *[Symbol.asyncIterator]() { yield record; },
    };
    const stored = { ...record };
    const Model = {
      find: () => ({ sort: () => ({ lean: () => ({ cursor: () => cursor }) }) }),
      collection: {
        name: "takeaways",
        updateOne: async (...args) => {
          updates.push(args);
          if (stored.branchId) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
          stored.branchId = args[1].$set.branchId;
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        },
        findOne: async () => ({ _id: stored._id, branchId: stored.branchId }),
      },
    };
    const base = { batchSize: 250, checkpoint: state, context: contextFor([creator]), resume: false };
    const dry = await migrateCollection("TakeAway", Model, { ...base, apply: false });
    expect(dry.summary.total).toBe(1);
    expect(updates).toHaveLength(0);
    const applied = await migrateCollection("TakeAway", Model, { ...base, apply: true });
    expect(applied.summary.migrated).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0][0].$or).toBeDefined();
    expect(String(stored.branchId)).toBe(String(branchA));
    const repeated = await migrateCollection("TakeAway", Model, { ...base, apply: true });
    expect(repeated.summary["write-not-matched"]).toBe(1);
  });

  test("native migration write persists branchId and verifies it", async () => {
    const recordId = id();
    let stored;
    const Model = { collection: {
      name: "billings",
      updateOne: async (filter, update) => {
        expect(filter).toEqual({ _id: recordId, $or: [{ branchId: { $exists: false } }, { branchId: null }] });
        stored = { _id: recordId, branchId: update.$set.branchId };
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
      },
      findOne: async () => stored,
    } };
    const result = await persistBranchOwnership(Model, recordId, branchA.toString());
    expect(result.decision).toBe("migrated");
    expect(result.diagnostic.persistedBranchId).toBe(String(branchA));
  });

  test.each([
    [{ acknowledged: true, matchedCount: 0, modifiedCount: 0 }, "write-not-matched"],
    [{ acknowledged: true, matchedCount: 1, modifiedCount: 0 }, "write-not-modified"],
    [{ acknowledged: false, matchedCount: 1, modifiedCount: 1 }, "error"],
  ])("write result %p is not falsely migrated", async (writeResult, expected) => {
    const Model = { collection: {
      name: "takeaways",
      updateOne: async () => writeResult,
      findOne: async () => ({ branchId: branchA }),
    } };
    await expect(persistBranchOwnership(Model, id(), branchA)).resolves.toMatchObject({ decision: expected });
  });

  test("post-write mismatch is not reported as migrated", async () => {
    const Model = { collection: {
      name: "tables",
      updateOne: async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
      findOne: async () => ({ branchId: branchB }),
    } };
    await expect(persistBranchOwnership(Model, id(), branchA)).resolves.toMatchObject({ decision: "persistence-verification-failed" });
  });

  test("migration guard never overwrites an existing branchId", async () => {
    const existing = { _id: id(), branchId: branchB };
    const Model = { collection: {
      name: "tables",
      updateOne: async (filter) => {
        expect(filter.$or).toEqual([{ branchId: { $exists: false } }, { branchId: null }]);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      },
      findOne: async () => existing,
    } };
    const result = await persistBranchOwnership(Model, existing._id, branchA);
    expect(result.decision).toBe("write-not-matched");
    expect(String(existing.branchId)).toBe(String(branchB));
  });

  test("normal application models retain immutable branchId", () => {
    for (const Model of [Billing, Table, TableOrder, TakeAway])
      expect(Model.schema.path("branchId").options.immutable).toBe(true);
  });

  test("checkpoint resume continues after the deterministic last ID", async () => {
    const first = id();
    const second = id();
    const seen = [];
    const cursor = { async *[Symbol.asyncIterator]() { yield { _id: second, createdBy: id(), branchId: null }; } };
    const Model = { find: (query) => { seen.push(query); return { sort: () => ({ lean: () => ({ cursor: () => cursor }) }) }; } };
    const result = await migrateCollection("TakeAway", Model, {
      batchSize: 1, apply: false, resume: true, checkpoint: { collections: { TakeAway: { lastProcessedId: first.toString() } } },
      context: contextFor([]),
    });
    expect(seen[0]._id.$gt).toBe(first.toString());
    expect(result.checkpoint.lastProcessedId).toBe(second.toString());
  });

  test("verification counts a direct branchId record", async () => {
    const member = id();
    const result = await verifyCollection(
      verificationModel([{ _id: id(), branchId: branchA, createdBy: id() }]),
      branchA.toString(),
      [member],
    );
    expect(result).toMatchObject({ directRecordCount: 1, legacyOnlyCount: 0, overlappingCount: 0, conflictingCount: 0 });
  });

  test("verification counts a legacy-only record", async () => {
    const member = id();
    const result = await verifyCollection(
      verificationModel([{ _id: id(), branchId: null, createdBy: member }]),
      branchA,
      [member],
    );
    expect(result).toMatchObject({ directRecordCount: 0, legacyOnlyCount: 1, overlappingCount: 0 });
  });

  test("verification counts overlapping membership without double-counting direct records", async () => {
    const member = id();
    const record = { _id: id(), branchId: branchA.toString(), createdBy: member.toString() };
    const result = await verifyCollection(verificationModel([record]), branchA, [member]);
    expect(result).toMatchObject({ directRecordCount: 1, legacyOnlyCount: 0, overlappingCount: 1 });
  });

  test("verification counts conflicting branch ownership", async () => {
    const member = id();
    const result = await verifyCollection(
      verificationModel([{ _id: id(), branchId: branchB.toString(), createdBy: member }]),
      branchA,
      [member],
    );
    expect(result).toMatchObject({ directRecordCount: 0, legacyOnlyCount: 0, conflictingCount: 1, crossBranchMismatchCount: 1 });
  });

  test("verification normalizes ObjectId and string branch IDs", async () => {
    const member = id();
    const result = await verifyCollection(
      verificationModel([
        { _id: id(), branchId: branchA, createdBy: member },
        { _id: id(), branchId: branchA.toString(), createdBy: member.toString() },
      ]),
      ` ${branchA.toString()} `,
      [member.toString()],
    );
    expect(result.directRecordCount).toBe(2);
  });

  test("rollback dry-run does not write and apply protects changed values", async () => {
    let writes = 0;
    const Model = { updateOne: async () => { writes += 1; return { modifiedCount: 0 }; } };
    const report = { collections: { TakeAway: { decisions: [{ decision: "migrated", recordId: "r1", candidateBranchId: String(branchA) }] } } };
    expect((await rollbackRecords(report, { TakeAway: Model }, false))[0].decision).toBe("would-unset");
    expect(writes).toBe(0);
    expect((await rollbackRecords(report, { TakeAway: Model }, true))[0].decision).toBe("skipped-current-value-changed");
    expect(writes).toBe(1);
  });
});
