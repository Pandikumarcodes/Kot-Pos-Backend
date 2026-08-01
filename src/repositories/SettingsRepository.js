const createBaseRepository = require("./BaseRepository");
const Settings = require("../models/settings");

const baseRepository = createBaseRepository(Settings);

const findScoped = (filter, options = {}) =>
  baseRepository.findOne(filter, undefined, options);

const findScopedLean = (filter, options = {}) =>
  baseRepository.findOne(filter, undefined, options).lean();

const createSettings = (data, options = {}) =>
  baseRepository.create(data, options);

const updateScoped = (filter, update, options = {}) =>
  Settings.findOneAndUpdate(
    filter,
    { $set: update },
    { new: true, runValidators: true, ...options },
  );

module.exports = {
  ...baseRepository,
  findScoped,
  findScopedLean,
  createSettings,
  updateScoped,
};
