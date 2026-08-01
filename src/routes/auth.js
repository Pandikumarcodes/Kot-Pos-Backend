const express = require("express");
const rateLimit = require("express-rate-limit");
const { validateLogin, validateSignup } = require("../validators/authentication");
const { userAuth, allowRoles } = require("../middlewares/auth");
const controller = require("../controllers/authController");
const { handleControllerError } = require("../controllers/controllerUtils");

const authRouter = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created. Please try again later." },
});

authRouter.post("/signup", signupLimiter, validateSignup, controller.signup);
authRouter.post("/login", loginLimiter, validateLogin, controller.login);
authRouter.get("/me", userAuth, allowRoles(["admin", "manager", "waiter", "chef", "cashier"]), controller.me);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.use(handleControllerError);

module.exports = { authRouter, authMiddleware: userAuth };
