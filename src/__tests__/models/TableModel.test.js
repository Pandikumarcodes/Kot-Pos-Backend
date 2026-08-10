const mongoose = require("mongoose");
const Table = require("../../models/tables");
const { buildDemoTables } = require("../../seedData/tables");

const branchId = new mongoose.Types.ObjectId();

const validTable = (overrides = {}) => ({
  branchId,
  tableNumber: 1,
  capacity: 4,
  ...overrides,
});

describe("Table model branch ownership", () => {
  it("accepts a valid branchId", () => {
    expect(new Table(validTable()).validateSync()).toBeUndefined();
  });

  it("requires branchId", () => {
    const error = new Table(validTable({ branchId: undefined })).validateSync();

    expect(error.errors.branchId.kind).toBe("required");
  });

  it("accepts billing as a persisted lifecycle state", () => {
    expect(
      new Table(validTable({ status: "billing" })).validateSync(),
    ).toBeUndefined();
  });

  it("rejects cleaning because there is no backend cleaning workflow", () => {
    const error = new Table(validTable({ status: "cleaning" })).validateSync();

    expect(error.errors.status.kind).toBe("enum");
  });

  it("declares branch-local table-number uniqueness without global uniqueness", () => {
    const compoundIndex = Table.schema.indexes().find(
      ([fields]) => fields.branchId === 1 && fields.tableNumber === 1,
    );

    expect(compoundIndex?.[1].unique).toBe(true);
    expect(Table.schema.path("tableNumber").options.unique).not.toBe(true);
  });

  it("allows the same table number to be valid in different branches", () => {
    const otherBranchId = new mongoose.Types.ObjectId();

    expect(new Table(validTable()).validateSync()).toBeUndefined();
    expect(
      new Table(validTable({ branchId: otherBranchId })).validateSync(),
    ).toBeUndefined();
  });
});

describe("Table demo seed data", () => {
  it("creates branch-owned tables with no duplicate number within a branch", () => {
    const tables = buildDemoTables(branchId);
    const ownershipKeys = tables.map(
      (table) => `${table.branchId}:${table.tableNumber}`,
    );

    expect(tables).toHaveLength(8);
    expect(tables.every((table) => table.branchId === branchId)).toBe(true);
    expect(new Set(ownershipKeys).size).toBe(tables.length);
    expect(tables.every((table) => !new Table(table).validateSync())).toBe(true);
  });

  it("refuses to build branchless demo tables", () => {
    expect(() => buildDemoTables()).toThrow("Demo tables require a branchId");
  });
});
