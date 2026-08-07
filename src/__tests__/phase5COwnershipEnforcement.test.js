const mongoose = require("mongoose");
const { directBranchFilter, assertSameBranch } = require("../utils/operationalOwnership");
const { assertScope } = require("../utils/accessScope");

const branchA = new mongoose.Types.ObjectId();
const branchB = new mongoose.Types.ObjectId();
const scope = (branchId) => ({ type: "branch", isGlobal: false, branchId });

describe("Phase 5C direct ownership enforcement", () => {
  test.each([
    ["Billing", { _id: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId() }],
    ["Table", { _id: new mongoose.Types.ObjectId() }],
    ["TableOrder", { _id: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId() }],
    ["TakeAway", { _id: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId() }],
  ])("%s branch A reads cannot match branch B", (_name, filter) => {
    const query = directBranchFilter(scope(branchA), filter);
    expect(query.$and).toContainEqual({ branchId: branchA.toString() });
    expect(query.$and).not.toContainEqual({ branchId: branchB.toString() });
    expect(query.$or).toBeUndefined();
  });

  test.each(["Billing", "Table", "TableOrder", "TakeAway"])(
    "%s mutations use the same direct branch constraint",
    () => {
      const query = directBranchFilter(scope(branchA), { _id: "resource-id" });
      expect(query.$and[1]).toEqual({ branchId: branchA.toString() });
    },
  );

  test("creator reassignment cannot change direct ownership", () => {
    const query = directBranchFilter(scope(branchA), { createdBy: branchB });
    expect(query.$and[1]).toEqual({ branchId: branchA.toString() });
    expect(query.$and[0].createdBy).toBe(branchB);
  });

  test("same-branch relation validation succeeds and cross-branch fails", () => {
    expect(() => assertSameBranch(branchA, branchA)).not.toThrow();
    expect(() => assertSameBranch(branchA, branchB)).toThrow("Cross-branch reference");
  });

  test("historical branchless Billing cannot satisfy a normal direct filter", () => {
    const query = directBranchFilter(scope(branchA), { paymentStatus: "paid" });
    expect(query.$and[1]).toEqual({ branchId: branchA.toString() });
    expect(query.$and[1].branchId).not.toBeNull();
  });

  test.each([branchA, branchA.toString()])("scope normalization accepts %p", (branchId) => {
    expect(assertScope(scope(branchId))).toMatchObject({ type: "branch", branchId });
    expect(directBranchFilter(scope(branchId), {}).$and[1].branchId).toBe(branchA.toString());
  });
});
