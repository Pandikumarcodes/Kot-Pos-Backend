const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { requireBranch } = branchScope;
const { allowGlobalOrSelectedBranch, requireBranchScope } = require("../../middlewares/accessScope");
const controller = require("../../controllers/billingController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateBillCreate,
  validateBillId,
  validateBillsQuery,
  validateBillPayment,
} = require("../../validators/billing");

const cashierbillingRouter = express.Router();
cashierbillingRouter.use(
  userAuth,
  allowRoles(["cashier", "admin", "manager"]),
  allowGlobalOrSelectedBranch,
  requireBranchScope,
);
cashierbillingRouter.post(
  "/billing",
  requireBranch,
  validateBillCreate,
  controller.createBill,
);
cashierbillingRouter.get("/bills", validateBillsQuery, controller.getBills);
cashierbillingRouter.get("/bills/:billId", validateBillId, controller.getBill);
cashierbillingRouter.put(
  "/bills/:billId/pay",
  validateBillPayment,
  controller.payBill,
);
cashierbillingRouter.delete(
  "/bills/:billId",
  validateBillId,
  controller.deleteBill,
);
cashierbillingRouter.use(handleControllerError);

module.exports = { cashierbillingRouter };
