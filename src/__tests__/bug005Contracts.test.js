const Table = require("../models/tables");

describe("BUG-005 table ownership contract", () => {
  it("keeps branch ownership required and immutable", () => {
    expect(Table.schema.path("branchId").options.required).toBe(true);
    expect(Table.schema.path("branchId").options.immutable).toBe(true);
  });

  it("uses branch-scoped table numbering", () => {
    const index = Table.schema.indexes().find(([fields, options]) =>
      fields.branchId === 1 && fields.tableNumber === 1 && options.unique === true,
    );
    expect(index).toBeDefined();
    expect(Table.schema.path("tableNumber").options.unique).not.toBe(true);
  });

  it("tracks the existing bill without changing TableOrder status names", () => {
    expect(Table.schema.path("status").enumValues).toEqual([
      "available", "occupied", "billing", "reserved",
    ]);
    const TableOrder = require("../models/waiter");
    expect(TableOrder.schema.path("billingId").options.default).toBeNull();
    expect(TableOrder.schema.path("status").enumValues).toEqual([
      "pending", "sent_to_kitchen", "served", "cancelled",
    ]);
  });
});
