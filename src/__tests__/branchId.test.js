const mongoose = require("mongoose");
const { BranchIdError, normalizeBranchId } = require("../utils/branchId");

describe("normalizeBranchId", () => {
  const objectId = new mongoose.Types.ObjectId();

  test("accepts an ObjectId string", () => {
    expect(normalizeBranchId(objectId.toString())).toBe(objectId.toString());
  });

  test("accepts a mongoose ObjectId", () => {
    expect(normalizeBranchId(objectId)).toBe(objectId.toString());
  });

  test("accepts the legacy serialized BSON buffer shape", () => {
    const buffer = Object.fromEntries(
      [...objectId.id].map((byte, index) => [index, byte]),
    );
    expect(normalizeBranchId({ buffer })).toBe(objectId.toString());
  });

  test("allows an explicitly missing branch only for global scope", () => {
    expect(normalizeBranchId(null, { allowMissing: true })).toBeNull();
  });

  test("rejects invalid and missing branch IDs", () => {
    expect(() => normalizeBranchId("not-an-object-id")).toThrow(BranchIdError);
    expect(() => normalizeBranchId(undefined)).toThrow(BranchIdError);
  });
});
