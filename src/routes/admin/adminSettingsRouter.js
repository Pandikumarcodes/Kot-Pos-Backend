const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const controller = require("../../controllers/settingsController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateSettingsUpdate } = require("../../validators/general");

const adminSettingsRouter = express.Router();
adminSettingsRouter.use(userAuth, allowRoles(["admin", "manager"]), branchScope);
adminSettingsRouter.get("/settings", controller.getSettings);
adminSettingsRouter.put("/settings", allowRoles(["admin"]), validateSettingsUpdate, controller.saveSettings);
adminSettingsRouter.use(handleControllerError);

module.exports = { adminSettingsRouter };
