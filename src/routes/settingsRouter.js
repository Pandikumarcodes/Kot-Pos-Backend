const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const {
  allowGlobalOrSelectedBranch,
  requireBranchScope,
} = require("../middlewares/accessScope");
const controller = require("../controllers/settingsController");
const { handleControllerError } = require("../controllers/controllerUtils");

const settingsRouter = express.Router();
settingsRouter.use(userAuth);
settingsRouter.get(
  "/settings",
  allowRoles(["admin", "manager", "cashier"]),
  allowGlobalOrSelectedBranch,
  requireBranchScope,
  controller.getSettings,
);
settingsRouter.use(handleControllerError);

module.exports = { settingsRouter };
