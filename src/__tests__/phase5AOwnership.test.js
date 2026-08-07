const mongoose = require("mongoose");
const Billing = require("../models/billings");
const Table = require("../models/tables");
const TableOrder = require("../models/waiter");
const TakeAway = require("../models/takeAway");
const { scopedOwnershipFilter, directBranchFilter } = require("../utils/operationalOwnership");

const branch = new mongoose.Types.ObjectId();
const member = new mongoose.Types.ObjectId();

describe("Phase 5A direct branch ownership", () => {
  test("Billing retains its historical-compatible branchId declaration", () => {
    const path = Billing.schema.path("branchId");
    expect(path).toBeDefined();
    expect(path.options.required).toEqual(expect.any(Function));
    expect(path.options.immutable).toBe(true);
    expect(path.options.ref).toBe("Branch");
  });

  test.each([Table, TableOrder, TakeAway])("declares required immutable branchId", (Model) => {
    const path = Model.schema.path("branchId");
    expect(path).toBeDefined();
    expect(path.options.required).toBe(true);
    expect(path.options.immutable).toBe(true);
    expect(path.options.ref).toBe("Branch");
  });

  test("legacy migration helper remains separate from operational ownership", () => {
    const filter = scopedOwnershipFilter({ type: "branch", branchId: branch, isGlobal: false }, [member], { _id: "bill" });
    expect(filter.$and[1].$or).toEqual(expect.arrayContaining([
      { branchId: branch },
      { branchId: null },
      { branchId: { $exists: false }, createdBy: { $in: [member.toString()] } },
    ]));
  });

  test("operational ownership never includes creator or branchless fallback", () => {
    const filter = directBranchFilter({ type: "branch", branchId: branch, isGlobal: false }, { _id: "bill", createdBy: member });
    expect(filter.$and[1]).toEqual({ branchId: branch.toString() });
    expect(JSON.stringify(filter)).not.toContain("$or");
  });

  test("historical branchless tables are not included by operational table scope", () => {
    expect(directBranchFilter({ type: "branch", branchId: branch, isGlobal: false }, { _id: "table" }).$and[1])
      .toEqual({ branchId: branch.toString() });
  });
});
