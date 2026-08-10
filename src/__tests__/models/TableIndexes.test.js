const {
  REQUIRED_TABLE_INDEX,
  ensureIndexes,
  ensureRequiredTableIndexes,
} = require("../../models/indexes");

const idIndex = { name: "_id_", key: { _id: 1 } };
const requiredIndex = {
  name: "branchId_1_tableNumber_1",
  key: { branchId: 1, tableNumber: 1 },
  unique: true,
};
const obsoleteIndex = {
  name: "tableNumber_1",
  key: { tableNumber: 1 },
  unique: true,
};

const createCollection = (initialIndexes) => {
  let indexes = initialIndexes.map((index) => ({ ...index }));
  return {
    indexes: jest.fn(async () => indexes.map((index) => ({ ...index }))),
    createIndex: jest.fn(async (key, options) => {
      indexes.push({
        name: Object.entries(key)
          .map(([field, direction]) => `${field}_${direction}`)
          .join("_"),
        key,
        ...options,
      });
      return indexes[indexes.length - 1].name;
    }),
    dropIndex: jest.fn(async (name) => {
      indexes = indexes.filter((index) => index.name !== name);
    }),
  };
};

describe("required Table index reconciliation", () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("accepts an existing correct compound unique index", async () => {
    const collection = createCollection([idIndex, requiredIndex]);

    await ensureRequiredTableIndexes(collection);

    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it("creates the required compound index when absent", async () => {
    const collection = createCollection([idIndex]);

    await ensureRequiredTableIndexes(collection);

    expect(collection.createIndex).toHaveBeenCalledWith(
      REQUIRED_TABLE_INDEX,
      { unique: true },
    );
  });

  it("creates the required index for a new collection namespace", async () => {
    const collection = createCollection([idIndex]);
    collection.indexes.mockRejectedValueOnce(
      Object.assign(new Error("namespace not found"), { code: 26 }),
    );

    await ensureRequiredTableIndexes(collection);

    expect(collection.createIndex).toHaveBeenCalledWith(
      REQUIRED_TABLE_INDEX,
      { unique: true },
    );
  });

  it("does not accept a partial index as full ownership protection", async () => {
    const partialIndex = {
      ...requiredIndex,
      partialFilterExpression: { tableNumber: { $exists: true } },
    };
    const collection = createCollection([idIndex, partialIndex]);
    collection.createIndex.mockRejectedValueOnce(
      new Error("existing partial index conflicts with required definition"),
    );

    await expect(ensureRequiredTableIndexes(collection)).rejects.toThrow(
      "existing partial index conflicts with required definition",
    );
  });

  it("surfaces required index creation failures", async () => {
    const collection = createCollection([idIndex]);
    collection.createIndex.mockRejectedValueOnce(new Error("duplicate keys"));

    await expect(
      ensureIndexes({
        tableCollection: collection,
        optionalInitializer: jest.fn(),
      }),
    ).rejects.toMatchObject({
      message: "duplicate keys",
      code: "REQUIRED_TABLE_INDEX_INITIALIZATION_FAILED",
    });
  });

  it("keeps optional index failures warning-only", async () => {
    const collection = createCollection([idIndex, requiredIndex]);
    const optionalInitializer = jest
      .fn()
      .mockRejectedValue(new Error("optional unavailable"));

    await expect(
      ensureIndexes({ tableCollection: collection, optionalInitializer }),
    ).resolves.toBeUndefined();
    expect(optionalInitializer).toHaveBeenCalledTimes(1);
  });

  it("removes obsolete global uniqueness after compound protection exists", async () => {
    const collection = createCollection([idIndex, obsoleteIndex]);

    await ensureRequiredTableIndexes(collection);

    expect(collection.createIndex.mock.invocationCallOrder[0]).toBeLessThan(
      collection.dropIndex.mock.invocationCallOrder[0],
    );
    expect(collection.dropIndex).toHaveBeenCalledWith("tableNumber_1");
  });

  it("does not remove unrelated indexes", async () => {
    const unrelated = {
      name: "tableNumber_1_status_1",
      key: { tableNumber: 1, status: 1 },
      unique: true,
    };
    const nonUniqueGlobal = {
      name: "tableNumber_non_unique",
      key: { tableNumber: 1 },
    };
    const collection = createCollection([
      idIndex,
      requiredIndex,
      unrelated,
      nonUniqueGlobal,
    ]);

    await ensureRequiredTableIndexes(collection);

    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it("is idempotent across repeated initialization and restart", async () => {
    const collection = createCollection([idIndex, obsoleteIndex]);

    await ensureRequiredTableIndexes(collection);
    await ensureRequiredTableIndexes(collection);

    expect(collection.createIndex).toHaveBeenCalledTimes(1);
    expect(collection.dropIndex).toHaveBeenCalledTimes(1);
  });
});
