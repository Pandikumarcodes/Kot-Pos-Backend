const createBaseRepository = require("../../repositories/BaseRepository");

describe("repository session forwarding", () => {
  test("base repository forwards a session to query and write operations", async () => {
    const session = { id: "session" };
    const documentSave = jest.fn().mockResolvedValue(undefined);
    const Model = jest.fn(function Model() {
      this.save = documentSave;
    });

    Object.assign(Model, {
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      create: jest.fn().mockResolvedValue([{ name: "item" }]),
      exists: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
      updateOne: jest.fn(),
    });

    const repository = createBaseRepository(Model);
    const options = { session };
    const savedDocument = { save: jest.fn() };

    repository.findById("id", undefined, options);
    repository.findOne({ active: true }, undefined, options);
    repository.findMany({ active: true }, undefined, options);
    await repository.create({ name: "item" }, options);
    await repository.createDocument({ name: "item" }, options);
    repository.updateById("id", { active: false }, options);
    repository.updateOne({ _id: "id" }, { active: false }, options);
    repository.deleteById("id", options);
    repository.deleteOne({ _id: "id" }, options);
    repository.exists({ _id: "id" }, options);
    repository.count({ active: true }, options);
    repository.aggregate([{ $match: {} }], options);
    repository.save(savedDocument, options);

    expect(Model.findById).toHaveBeenCalledWith("id", undefined, options);
    expect(Model.findOne).toHaveBeenCalledWith(
      { active: true },
      undefined,
      options,
    );
    expect(Model.find).toHaveBeenCalledWith(
      { active: true },
      undefined,
      options,
    );
    expect(Model.create).toHaveBeenCalledWith([{ name: "item" }], options);
    expect(documentSave).toHaveBeenCalledWith(options);
    expect(Model.findByIdAndUpdate).toHaveBeenCalledWith(
      "id",
      { active: false },
      options,
    );
    expect(Model.updateOne).toHaveBeenCalledWith(
      { _id: "id" },
      { active: false },
      options,
    );
    expect(Model.findByIdAndDelete).toHaveBeenCalledWith("id", options);
    expect(Model.findOneAndDelete).toHaveBeenCalledWith({ _id: "id" }, options);
    expect(Model.exists).toHaveBeenCalledWith({ _id: "id" }, options);
    expect(Model.countDocuments).toHaveBeenCalledWith(
      { active: true },
      options,
    );
    expect(Model.aggregate).toHaveBeenCalledWith([{ $match: {} }], options);
    expect(savedDocument.save).toHaveBeenCalledWith(options);
  });

  test("base repository preserves calls without options", () => {
    const Model = {
      findOne: jest.fn(),
    };
    const repository = createBaseRepository(Model);

    repository.findOne({ active: true });

    expect(Model.findOne).toHaveBeenCalledWith({ active: true });
  });
});
