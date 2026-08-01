const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const controller = require("../../controllers/menuController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateMenuCreate, validateMenuId, validateMenuUpdate } = require("../../validators/menu");

const adminMenuRouter = express.Router();
adminMenuRouter.use(userAuth, branchScope);
adminMenuRouter.post("/menu", allowRoles(["admin", "manager"]), validateMenuCreate, controller.createMenuItem);
adminMenuRouter.get("/menuItems", allowRoles(["admin", "manager", "waiter", "chef", "cashier"]), controller.listMenuItems);
adminMenuRouter.put("/menu-item/:ItemId", allowRoles(["admin", "manager"]), validateMenuUpdate, controller.updateMenuItem);
adminMenuRouter.delete("/delete/:ItemId", allowRoles(["admin"]), validateMenuId, controller.deleteMenuItem);
adminMenuRouter.use(handleControllerError);

module.exports = { adminMenuRouter };
