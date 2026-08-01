const settingsService = require("../services/settingsService");
const { forwardError } = require("./controllerUtils");

const getSettings = async (req, res, next) => { try { const settings = await settingsService.getSettings(req.branchFilter, req.branchId); res.status(200).json({ settings }); } catch (err) { forwardError(next, err); } };
const saveSettings = async (req, res, next) => { try { const settings = await settingsService.saveSettings(req.branchFilter, req.scopeToBranch, req.branchId, req.body); res.status(200).json({ message: "Settings saved successfully", settings }); } catch (err) { forwardError(next, err); } };
module.exports = { getSettings, saveSettings };
