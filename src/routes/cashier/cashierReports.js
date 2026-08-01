const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { getCashierIncome } = require("../../controllers/reportController");
const { handleControllerError } = require("../../controllers/controllerUtils");

const cashierReportsRouter = express.Router();
cashierReportsRouter.use(userAuth, allowRoles(["cashier"]), branchScope);
cashierReportsRouter.get("/income", getCashierIncome);
cashierReportsRouter.use(handleControllerError);

module.exports = { cashierReportsRouter };
