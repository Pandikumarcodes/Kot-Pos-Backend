const mongoose = require("mongoose");
const { normalizeObjectId } = require("../../utils/branchId");

describe("normalizeObjectId", () => {
  const objectId = new mongoose.Types.ObjectId();

  test.each([
    [objectId.toString(), objectId.toString()],
    [objectId, objectId.toString()],
    [{ _id: objectId }, objectId.toString()],
    [{ _id: objectId.toString() }, objectId.toString()],
    [
      { buffer: Object.fromEntries([...objectId.id].map((byte, index) => [index, byte])) },
      objectId.toString(),
    ],
  ])("normalizes supported ID shape", (input, expected) => {
    expect(normalizeObjectId(input)).toBe(expected);
  });

  test.each([null, undefined, "", "not-an-object-id", { _id: "invalid" }])(
    "rejects invalid ID shape",
    (input) => expect(normalizeObjectId(input)).toBeNull(),
  );
});
