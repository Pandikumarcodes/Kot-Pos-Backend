const { checkOwnershipInvariants, getExitCode } = require("../scripts/checkOwnershipInvariants");
const { assertSameBranch, assertBranchIdImmutableUpdate } = require("../utils/operationalOwnership");

const id = (n) => `00000000000000000000000${n}`;
const makeReader = (data) => async (Model) => data.get(Model) || [];

describe("Phase 5E ownership invariant monitoring", () => {
  const makeModels = () => new Map();
  test("clean dataset returns clean and no violations", async () => {
    const data = makeModels(); const branch = { _id: id(1) };
    const models = {}; for (const name of ["Table", "TableOrder", "TakeAway", "Inventory", "KOT", "StockLog", "Billing"]) { models[name] = {}; data.set(models[name], [{ _id: id(name.length), branchId: branch._id, paymentStatus: "paid" }]); }
    data.set({}, [branch]);
    const report = await checkOwnershipInvariants({ modelMap: models, branchModel: [...data.keys()].at(-1), readModel: makeReader(data) });
    expect(report.status).toBe("clean"); expect(report.violations).toHaveLength(0);
  });

  test("branchless operational record is critical", async () => {
    const data = makeModels(); const models = { Table: {} }; const branchModel = {};
    data.set(models.Table, [{ _id: id(2), status: "occupied" }]); data.set(branchModel, []);
    const report = await checkOwnershipInvariants({ modelMap: models, branchModel, readModel: makeReader(data) });
    expect(report.status).toBe("critical"); expect(report.violations[0].type).toBe("table-without-branchId");
  });

  test("historical branchless Billing is warning only", async () => {
    const data = makeModels(); const billing = {}; const branchModel = {};
    data.set(billing, [{ _id: id(3), paymentStatus: "paid", createdAt: new Date("2020-01-01") }]); data.set(branchModel, []);
    const report = await checkOwnershipInvariants({ modelMap: { Billing: billing }, branchModel, cutoff: new Date("2025-01-01"), readModel: makeReader(data) });
    expect(report.status).toBe("warning"); expect(report.warnings[0].type).toBe("historical-branchless-billing"); expect(report.violations).toHaveLength(0);
    expect(getExitCode(report)).toBe(0);
  });

  test("critical report returns exit status 1", () => {
    expect(getExitCode({ violations: [{}] })).toBe(1);
    expect(getExitCode({ violations: [] })).toBe(0);
  });

  test("cross-branch relationship and orphan branch are critical", async () => {
    const data = makeModels(); const tableOrder = {}; const table = {}; const branchModel = {};
    data.set(tableOrder, [{ _id: id(4), branchId: id(1), tableId: id(5) }]); data.set(table, [{ _id: id(5), branchId: id(2) }]); data.set(branchModel, [{ _id: id(1) }]);
    const report = await checkOwnershipInvariants({ modelMap: { TableOrder: tableOrder, Table: table }, branchModel, readModel: makeReader(data) });
    expect(report.violations.some((v) => v.type === "cross-branch-linked-resource")).toBe(true);
    expect(report.violations.some((v) => v.type === "orphaned-branch-reference")).toBe(true);
  });

  test("runtime guards emit structured ownership logs", () => {
    const logger = require("../config/logger"); const warn = jest.spyOn(logger, "warn").mockImplementation(() => {}); const error = jest.spyOn(logger, "error").mockImplementation(() => {});
    expect(() => assertSameBranch(id(1), id(2))).toThrow(); expect(() => assertBranchIdImmutableUpdate({ $set: { branchId: id(2) } })).toThrow();
    expect(warn).toHaveBeenCalledWith("ownership invariant violation", expect.objectContaining({ event: "ownership.invariant.violation", operation: "assertSameBranch" }));
    expect(error).toHaveBeenCalledWith("ownership invariant violation", expect.objectContaining({ operation: "immutable-branchId-update" })); warn.mockRestore(); error.mockRestore();
  });
});
