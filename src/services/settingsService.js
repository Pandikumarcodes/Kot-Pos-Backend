const Settings = require("../models/settings");

const getSettings = async (branchFilter, branchId) => {
  const settings = await Settings.findOne(branchFilter);
  return settings || Settings.create({ branchId });
};

const saveSettings = async (branchFilter, scopeToBranch, branchId, input) => {
  const settingsInput = { ...input };
  delete settingsInput.branchId;
  const existing = await Settings.findOne(branchFilter);
  if (!existing) return Settings.create({ ...settingsInput, branchId });
  return Settings.findOneAndUpdate(
    scopeToBranch({ _id: existing._id }),
    { $set: settingsInput },
    { new: true, runValidators: true },
  );
};

module.exports = { getSettings, saveSettings };
