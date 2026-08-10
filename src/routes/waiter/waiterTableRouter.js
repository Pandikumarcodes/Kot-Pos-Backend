const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { requireBranch } = branchScope;
const controller = require("../../controllers/waiterTableController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateTableAllocate,
  validateWaiterTableId,
} = require("../../validators/tables");

const waiterTableRouter = express.Router();
waiterTableRouter.use(
  userAuth,
  allowRoles(["waiter", "manager", "admin"]),
  branchScope,
);
waiterTableRouter.post(
  "/allocate/:tableId",
  requireBranch,
  validateTableAllocate,
  controller.allocateTable,
);
waiterTableRouter.put(
  "/free/:tableId",
  requireBranch,
  validateWaiterTableId,
  controller.freeTable,
);
waiterTableRouter.use(handleControllerError);

module.exports = { waiterTableRouter };
