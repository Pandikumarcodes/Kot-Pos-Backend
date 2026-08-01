const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const controller = require("../../controllers/customerController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const { validateCustomerCreate, validateCustomerId, validateCustomerUpdate } = require("../../validators/customers");

const adminCustomerRouter = express.Router();
adminCustomerRouter.use(userAuth, allowRoles(["admin", "manager"]), branchScope);
adminCustomerRouter.get("/customers", controller.listCustomers);
adminCustomerRouter.get("/customers/:customerId", validateCustomerId, controller.getCustomer);
adminCustomerRouter.post("/customers", validateCustomerCreate, controller.createCustomer);
adminCustomerRouter.put("/customers/:customerId", validateCustomerUpdate, controller.updateCustomer);
adminCustomerRouter.delete("/customers/:customerId", allowRoles(["admin"]), validateCustomerId, controller.deleteCustomer);
adminCustomerRouter.use(handleControllerError);

module.exports = { adminCustomerRouter };
