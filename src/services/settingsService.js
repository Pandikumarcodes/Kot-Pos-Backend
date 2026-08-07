const settingsRepository = require("../repositories/SettingsRepository");
const { cache, cacheKeys } = require("../infrastructure/cache");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

// Keep this allow-list explicit so adding a field to the Settings schema does
// not automatically expose it to cashier accounts.
const CASHIER_SETTINGS_FIELDS = Object.freeze([
  "businessName",
  "phone",
  "address",
  "currency",
  "timezone",
  "taxRate",
  "serviceCharge",
  "autoRoundOff",
  "printReceipt",
  "paymentMethods",
  "takeawayEnabled",
  "deliveryEnabled",
]);

const toPlainObject = (settings) => {
  if (!settings) return settings;
  if (typeof settings.toObject === "function") return settings.toObject();
  return { ...settings };
};

const sanitizeCashierSettings = (settings) => {
  const plainSettings = toPlainObject(settings);
  if (!plainSettings) return plainSettings;

  return CASHIER_SETTINGS_FIELDS.reduce((safeSettings, field) => {
    if (plainSettings[field] === undefined) return safeSettings;
    if (field === "paymentMethods" && plainSettings[field]) {
      safeSettings.paymentMethods = {
        cash: Boolean(plainSettings[field].cash),
        card: Boolean(plainSettings[field].card),
        upi: Boolean(plainSettings[field].upi),
      };
    } else {
      safeSettings[field] = plainSettings[field];
    }
    return safeSettings;
  }, {});
};

const writeFailure = async (values) => {
  try { await administrationAudit.failure(values); } catch (_auditFailure) {
    // A secondary audit outage must not replace the workflow error.
  }
};

const requireBranchScope = (scope) => {
  if (!scope || scope.type !== "branch" || !scope.branchId) {
    const error = new Error("A branch selection is required for settings");
    error.status = 403;
    throw error;
  }
  return scope;
};

const getSettings = async (scope) => {
  const { branchId } = requireBranchScope(scope);
  return cache.getOrSet(cacheKeys.settings({ branchId }), async () => {
    const settings = await settingsRepository.findScoped({ branchId });
    return settings || settingsRepository.createSettings({ branchId });
  }, { ttlSeconds: 600 });
};

const saveSettings = async (scope, input, audit = {}) => {
  const { branchId } = requireBranchScope(scope);
  const context = administrationAudit.createContext({ ...audit, branchId });
  let settingsId = "settings:pending";
  try {
  const settingsInput = { ...input };
  delete settingsInput.branchId;
    const existing = await settingsRepository.findScoped({ branchId });
  let settings;
  if (!existing) {
    settings = await settingsRepository.createSettings({ ...settingsInput, branchId });
  } else {
    settingsId = existing._id;
      settings = await settingsRepository.updateScoped(
      { _id: existing._id, branchId }, settingsInput,
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
  getSettings,
  saveSettings,
  sanitizeCashierSettings,
  CASHIER_SETTINGS_FIELDS,
};
