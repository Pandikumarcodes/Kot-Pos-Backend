const createBaseRepository = require("./BaseRepository");
const Settings = require("../models/settings");

const baseRepository = createBaseRepository(Settings);

const findScoped = (filter) => baseRepository.findOne(filter);

const findScopedLean = (filter) => baseRepository.findOne(filter).lean();

const createSettings = (data) => baseRepository.create(data);

const updateScoped = (filter, update) =>
  Settings.findOneAndUpdate(
    filter,
    { $set: update },
    { new: true, runValidators: true },
  );

module.exports = {
  ...baseRepository,
  findScoped,
  findScopedLean,
  createSettings,
  updateScoped,
};
