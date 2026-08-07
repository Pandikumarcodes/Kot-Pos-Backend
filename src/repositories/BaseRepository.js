const createBaseRepository = (Model) => {
  const assertOwnershipImmutable = (update = {}) => {
    const hasBranchId = (value) => value && Object.prototype.hasOwnProperty.call(value, "branchId");
    if (hasBranchId(update) || hasBranchId(update.$set) || hasBranchId(update.$unset)) {
      throw new Error("branchId is immutable after creation");
    }
  };
  const hasOptions = (options) =>
    options && Object.keys(options).length > 0;

  const findById = (id, projection, options = {}) => {
    if (hasOptions(options)) return Model.findById(id, projection, options);
    if (projection !== undefined) return Model.findById(id, projection);
    return Model.findById(id);
  };

  const findOne = (filter, projection, options = {}) => {
    if (hasOptions(options)) return Model.findOne(filter, projection, options);
    if (projection !== undefined) return Model.findOne(filter, projection);
    return Model.findOne(filter);
  };

  const findMany = (filter = {}, projection, options = {}) => {
    if (hasOptions(options)) return Model.find(filter, projection, options);
    if (projection !== undefined) return Model.find(filter, projection);
    return Model.find(filter);
  };

  const create = (data, options = {}) => {
    if (!hasOptions(options)) return Model.create(data);
    if (Array.isArray(data)) return Model.create(data, options);

    return Model.create([data], options).then(([document]) => document);
  };

  const createDocument = async (data, options = {}) => {
    const document = new Model(data);
    if (hasOptions(options)) await document.save(options);
    else await document.save();
    return document;
  };

  const updateById = (id, update, options = {}) => {
    assertOwnershipImmutable(update);
    return hasOptions(options)
      ? Model.findByIdAndUpdate(id, update, options)
      : Model.findByIdAndUpdate(id, update);
  };

  const updateOne = (filter, update, options = {}) => {
    assertOwnershipImmutable(update);
    return hasOptions(options)
      ? Model.updateOne(filter, update, options)
      : Model.updateOne(filter, update);
  };

  const deleteById = (id, options = {}) =>
    hasOptions(options)
      ? Model.findByIdAndDelete(id, options)
      : Model.findByIdAndDelete(id);

  const deleteOne = (filter, options = {}) =>
    hasOptions(options)
      ? Model.findOneAndDelete(filter, options)
      : Model.findOneAndDelete(filter);

  const exists = (filter, options = {}) =>
    hasOptions(options) ? Model.exists(filter, options) : Model.exists(filter);
  const count = (filter = {}, options = {}) =>
    hasOptions(options)
      ? Model.countDocuments(filter, options)
      : Model.countDocuments(filter);
  const aggregate = (pipeline, options = {}) =>
    hasOptions(options)
      ? Model.aggregate(pipeline, options)
      : Model.aggregate(pipeline);
  const save = (document, options = {}) =>
    hasOptions(options) ? document.save(options) : document.save();

  return {
    findById,
    findOne,
    findMany,
    create,
    createDocument,
    updateById,
    updateOne,
    deleteById,
    deleteOne,
    exists,
    count,
    aggregate,
    save,
  };
};

module.exports = createBaseRepository;
