const settingsService = require("../services/settingsService");
const { forwardError } = require("./controllerUtils");

const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings(req.accessScope);
    res.status(200).json({
      settings:
        req.user?.role === "cashier"
          ? settingsService.sanitizeCashierSettings(settings)
          : settings,
    });
  } catch (err) {
    forwardError(next, err, "Failed to fetch settings");
  }
};
const saveSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.saveSettings(req.accessScope, req.body);
    res.status(200).json({ message: "Settings saved successfully", settings });
  } catch (err) {
    forwardError(next, err, "Failed to save settings");
  }
};
module.exports = { getSettings, saveSettings };
