const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { requireBranch } = branchScope;
const controller = require("../../controllers/tableController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateTableCreate,
  validateTableId,
  validateTableUpdate,
} = require("../../validators/tables");

const adminTableRouter = express.Router();
adminTableRouter.use(userAuth, branchScope);
adminTableRouter.post(
  "/tables",
  allowRoles(["admin", "manager"]),
  requireBranch,
  validateTableCreate,
  controller.createTable,
);
adminTableRouter.get(
  "/tables",
  allowRoles(["admin", "manager", "waiter", "cashier"]),
  requireBranch,
  controller.listTables,
);
adminTableRouter.get(
  "/tables/:id",
  allowRoles(["admin", "manager", "waiter", "cashier"]),
  requireBranch,
  validateTableId,
  controller.getTable,
);
adminTableRouter.put(
  "/tables/:id",
  allowRoles(["admin", "manager"]),
  requireBranch,
  validateTableUpdate,
  controller.updateTable,
);
adminTableRouter.delete(
  "/tables/:id",
  allowRoles(["admin"]),
  requireBranch,
  validateTableId,
  controller.deleteTable,
);
adminTableRouter.use(handleControllerError);

module.exports = { adminTableRouter };
