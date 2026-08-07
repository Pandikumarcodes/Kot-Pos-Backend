const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { allowGlobalOrSelectedBranch } = require("../../middlewares/accessScope");
const { requireBranch } = branchScope;
const controller = require("../../controllers/userController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateCreateUser,
  validateRoleUpdate,
  validateUserId,
} = require("../../validators/users");

const adminUserRouter = express.Router();
adminUserRouter.use(userAuth, allowGlobalOrSelectedBranch);
adminUserRouter.post(
  "/create-user",
  allowRoles(["admin"]),
  requireBranch,
  validateCreateUser,
  controller.createUser,
);
adminUserRouter.get(
  "/users",
  allowRoles(["admin", "manager"]),
  controller.listUsers,
);
adminUserRouter.put(
  "/update-role/:userId",
  allowRoles(["admin", "manager"]),
  validateRoleUpdate,
  controller.updateUserRole,
);
adminUserRouter.delete(
  "/deleteUser/:userId",
  allowRoles(["admin"]),
  validateUserId,
  controller.deleteUser,
);
adminUserRouter.use(handleControllerError);

module.exports = { adminUserRouter };
