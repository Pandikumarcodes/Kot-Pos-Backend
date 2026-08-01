const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { branchMemberScope } = branchScope;
const controller = require("../../controllers/reportController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateReportQuery } = require("../../validators/general");

const adminReportRouter = express.Router();
adminReportRouter.use(userAuth, allowRoles(["admin", "manager"]), branchScope, branchMemberScope);
adminReportRouter.get("/reports/summary", validateReportQuery, controller.getSummary);
adminReportRouter.get("/reports/top-items", validateReportQuery, controller.getTopItems);
adminReportRouter.get("/reports/payments", validateReportQuery, controller.getPayments);
adminReportRouter.get("/reports/hourly", validateReportQuery, controller.getHourlySales);
adminReportRouter.use(handleControllerError);

module.exports = { adminReportRouter };
