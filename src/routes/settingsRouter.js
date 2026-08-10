const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const branchScope = require("../middlewares/branchScope");
const controller = require("../controllers/settingsController");
const { handleControllerError } = require("../controllers/controllerUtils");

const settingsRouter = express.Router();

settingsRouter.use(
  userAuth,
  allowRoles(["admin", "manager", "cashier"]),
  branchScope,
);
settingsRouter.get("/", controller.getReceiptSettings);
settingsRouter.use(handleControllerError);

module.exports = { settingsRouter };
