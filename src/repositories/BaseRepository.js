class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  findById(id, projection, options) {
    if (options !== undefined) return this.model.findById(id, projection, options);
    if (projection !== undefined) return this.model.findById(id, projection);
    return this.model.findById(id);
  }

  findOne(filter, projection, options) {
    if (options !== undefined) return this.model.findOne(filter, projection, options);
    if (projection !== undefined) return this.model.findOne(filter, projection);
    return this.model.findOne(filter);
  }

  findMany(filter = {}, projection, options) {
    if (options !== undefined) return this.model.find(filter, projection, options);
    if (projection !== undefined) return this.model.find(filter, projection);
    return this.model.find(filter);
  }

  create(data, options) {
    return options === undefined
      ? this.model.create(data)
      : this.model.create(data, options);
  }

  async createDocument(data, saveOptions) {
    const document = new this.model(data);
    if (saveOptions === undefined) await document.save();
    else await document.save(saveOptions);
    return document;
  }

  updateById(id, update, options) {
    return options === undefined
      ? this.model.findByIdAndUpdate(id, update)
      : this.model.findByIdAndUpdate(id, update, options);
  }

  updateOne(filter, update, options) {
    return options === undefined
      ? this.model.updateOne(filter, update)
      : this.model.updateOne(filter, update, options);
  }

  deleteById(id, options) {
    return options === undefined
      ? this.model.findByIdAndDelete(id)
      : this.model.findByIdAndDelete(id, options);
  }

  deleteOne(filter, options) {
    return options === undefined
      ? this.model.findOneAndDelete(filter)
      : this.model.findOneAndDelete(filter, options);
  }

  exists(filter) {
    return this.model.exists(filter);
  }

  count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  aggregate(pipeline, options) {
    return options === undefined
      ? this.model.aggregate(pipeline)
      : this.model.aggregate(pipeline, options);
  }

  save(document, options) {
    return options === undefined ? document.save() : document.save(options);
  }
}

module.exports = BaseRepository;
