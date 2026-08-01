const settingsRepository = require("../repositories/SettingsRepository");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const writeFailure = async (values) => {
  try { await administrationAudit.failure(values); } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const getSettings = async (branchFilter, branchId) => {
  const settings = await settingsRepository.findScoped(branchFilter);
  return settings || settingsRepository.createSettings({ branchId });
};

const saveSettings = async (branchFilter, scopeToBranch, branchId, input, audit = {}) => {
  const context = administrationAudit.createContext({ ...audit, branchId });
  let settingsId = "settings:pending";
  try {
  const settingsInput = { ...input };
  delete settingsInput.branchId;
  const existing = await settingsRepository.findScoped(branchFilter);
  let settings;
  if (!existing) {
    settings = await settingsRepository.createSettings({ ...settingsInput, branchId });
  } else {
    settingsId = existing._id;
    settings = await settingsRepository.updateScoped(
      scopeToBranch({ _id: existing._id }), settingsInput,
    );
  }
  settingsId = settings?._id ?? settingsId;
  await administrationAudit.settingsChanged({ context, settingsId,
    before: existing || {}, after: settings, category: audit.category || "general" });
  return settings;
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.SETTINGS_UPDATE, context, entityId: settingsId, error });
    throw error;
  }
};

module.exports = { getSettings, saveSettings };
