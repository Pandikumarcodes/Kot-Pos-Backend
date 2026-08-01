const BaseRepository = require("./BaseRepository");
const Settings = require("../models/settings");

class SettingsRepository extends BaseRepository {
  constructor() {
    super(Settings);
  }

  findScoped(filter) {
    return this.findOne(filter);
  }

  findScopedLean(filter) {
    return this.findOne(filter).lean();
  }

  createSettings(data) {
    return this.create(data);
  }

  updateScoped(filter, update) {
    return this.model.findOneAndUpdate(
      filter,
      { $set: update },
      { new: true, runValidators: true },
    );
  }
}

module.exports = new SettingsRepository();
module.exports.SettingsRepository = SettingsRepository;
