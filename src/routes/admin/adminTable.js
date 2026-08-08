const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const { allowGlobalOrSelectedBranch } = require("../../middlewares/accessScope");
const controller = require("../../controllers/tableController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateTableCreate,
  validateTableId,
  validateTableUpdate,
} = require("../../validators/tables");

const adminTableRouter = express.Router();
adminTableRouter.use(userAuth, allowGlobalOrSelectedBranch);
adminTableRouter.post(
  "/tables",
  allowRoles(["admin", "manager"]),
  validateTableCreate,
  controller.createTable,
);
adminTableRouter.get(
  "/tables",
  allowRoles(["admin", "manager", "waiter", "cashier"]),
  controller.listTables,
);
adminTableRouter.get(
  "/tables/:id",
  allowRoles(["admin", "manager", "waiter", "cashier"]),
  validateTableId,
  controller.getTable,
);
adminTableRouter.put(
  "/tables/:id",
  allowRoles(["admin", "manager"]),
  validateTableUpdate,
  controller.updateTable,
);
adminTableRouter.delete(
  "/tables/:id",
  allowRoles(["admin"]),
  validateTableId,
  controller.deleteTable,
);
adminTableRouter.use(handleControllerError);

module.exports = { adminTableRouter };
