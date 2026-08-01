const createBaseRepository = (Model) => {
  const findById = (id, projection, options) => {
    if (options !== undefined) return Model.findById(id, projection, options);
    if (projection !== undefined) return Model.findById(id, projection);
    return Model.findById(id);
  };

  const findOne = (filter, projection, options) => {
    if (options !== undefined) return Model.findOne(filter, projection, options);
    if (projection !== undefined) return Model.findOne(filter, projection);
    return Model.findOne(filter);
  };

  const findMany = (filter = {}, projection, options) => {
    if (options !== undefined) return Model.find(filter, projection, options);
    if (projection !== undefined) return Model.find(filter, projection);
    return Model.find(filter);
  };

  const create = (data, options) =>
    options === undefined ? Model.create(data) : Model.create(data, options);

  const createDocument = async (data, saveOptions) => {
    const document = new Model(data);
    if (saveOptions === undefined) await document.save();
    else await document.save(saveOptions);
    return document;
  };

  const updateById = (id, update, options) =>
    options === undefined
      ? Model.findByIdAndUpdate(id, update)
      : Model.findByIdAndUpdate(id, update, options);

  const updateOne = (filter, update, options) =>
    options === undefined
      ? Model.updateOne(filter, update)
      : Model.updateOne(filter, update, options);

  const deleteById = (id, options) =>
    options === undefined
      ? Model.findByIdAndDelete(id)
      : Model.findByIdAndDelete(id, options);

  const deleteOne = (filter, options) =>
    options === undefined
      ? Model.findOneAndDelete(filter)
      : Model.findOneAndDelete(filter, options);

  const exists = (filter) => Model.exists(filter);
  const count = (filter = {}) => Model.countDocuments(filter);
  const aggregate = (pipeline, options) =>
    options === undefined
      ? Model.aggregate(pipeline)
      : Model.aggregate(pipeline, options);
  const save = (document, options) =>
    options === undefined ? document.save() : document.save(options);

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
