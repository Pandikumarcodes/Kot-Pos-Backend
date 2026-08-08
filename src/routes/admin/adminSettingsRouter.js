const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const { allowGlobalOrSelectedBranch, requireBranchScope } = require("../../middlewares/accessScope");
const controller = require("../../controllers/settingsController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateSettingsUpdate } = require("../../validators/general");

const adminSettingsRouter = express.Router();
adminSettingsRouter.use(userAuth);
adminSettingsRouter.get(
  "/settings",
  allowRoles(["admin", "manager"]),
  allowGlobalOrSelectedBranch,
  requireBranchScope,
  controller.getSettings,
);
adminSettingsRouter.put(
  "/settings",
  allowRoles(["admin"]),
  allowGlobalOrSelectedBranch,
  requireBranchScope,
  validateSettingsUpdate,
  controller.saveSettings,
);
adminSettingsRouter.use(handleControllerError);

module.exports = { adminSettingsRouter };
