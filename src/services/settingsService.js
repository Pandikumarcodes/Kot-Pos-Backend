const settingsRepository = require("../repositories/SettingsRepository");

const getSettings = async (branchFilter, branchId) => {
  const settings = await settingsRepository.findScoped(branchFilter);
  return settings || settingsRepository.createSettings({ branchId });
};

const saveSettings = async (branchFilter, scopeToBranch, branchId, input) => {
  const settingsInput = { ...input };
  delete settingsInput.branchId;
  const existing = await settingsRepository.findScoped(branchFilter);
  if (!existing)
    return settingsRepository.createSettings({ ...settingsInput, branchId });
  return settingsRepository.updateScoped(
    scopeToBranch({ _id: existing._id }),
    settingsInput,
  );
};

module.exports = { getSettings, saveSettings };
