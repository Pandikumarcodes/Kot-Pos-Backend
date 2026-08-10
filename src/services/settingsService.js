const settingsRepository = require("../repositories/SettingsRepository");
const { cache, cacheKeys } = require("../infrastructure/cache");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const RECEIPT_SETTINGS_FIELDS = Object.freeze([
  "businessName",
  "email",
  "phone",
  "address",
  "gstin",
  "fssai",
  "hsn",
  "currency",
  "taxRate",
  "serviceCharge",
  "autoRoundOff",
  "printReceipt",
]);

const writeFailure = async (values) => {
  try { await administrationAudit.failure(values); } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const getSettings = async (branchFilter, branchId) => {
  return cache.getOrSet(cacheKeys.settings({ branchId }), async () => {
    const settings = await settingsRepository.findScoped(branchFilter);
    return settings || settingsRepository.createSettings({ branchId });
  }, { ttlSeconds: 600 });
};

const getReceiptSettings = async (branchFilter, branchId) => {
  const settings = await getSettings(branchFilter, branchId);
  return RECEIPT_SETTINGS_FIELDS.reduce((projection, field) => {
    projection[field] = settings[field];
    return projection;
  }, {});
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
  if (branchId) await cache.del(cacheKeys.settings({ branchId }));
  else await cache.invalidatePattern("kot-pos:v1:settings:*");
  await administrationAudit.settingsChanged({ context, settingsId,
    before: existing || {}, after: settings, category: audit.category || "general" });
  return settings;
  } catch (error) {
    await writeFailure({ action: AUDIT_ACTIONS.SETTINGS_UPDATE, context, entityId: settingsId, error });
    throw error;
  }
};

module.exports = {
  RECEIPT_SETTINGS_FIELDS,
  getSettings,
  getReceiptSettings,
  saveSettings,
};
