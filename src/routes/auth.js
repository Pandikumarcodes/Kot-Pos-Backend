const express = require("express");
const {
  validateLogin,
  validateSignup,
} = require("../validators/authentication");
const { userAuth, allowRoles } = require("../middlewares/auth");
const controller = require("../controllers/authController");
const { handleControllerError } = require("../controllers/controllerUtils");
const { signupLimiter } = require("../middlewares/ratelimiter");

const authRouter = express.Router();
authRouter.post("/signup", signupLimiter, validateSignup, controller.signup);
authRouter.post("/login", validateLogin, controller.login);
authRouter.get(
  "/me",
  userAuth,
  allowRoles(["superadmin", "admin", "manager", "waiter", "chef", "cashier"]),
  controller.me,
);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.use(handleControllerError);

module.exports = { authRouter, authMiddleware: userAuth };
