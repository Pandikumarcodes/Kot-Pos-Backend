const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const branchScope = require("../middlewares/branchScope");
const { branchMemberScope } = branchScope;
const {
  allowGlobalOrSelectedBranch,
  requireBranchScope,
} = require("../middlewares/accessScope");
const controller = require("../controllers/aiController");
const { handleControllerError } = require("../controllers/controllerUtils");
const { validateAiChat } = require("../validators/general");

const router = express.Router();
router.use(
  userAuth,
  allowRoles(["admin", "manager"]),
  allowGlobalOrSelectedBranch,
  requireBranchScope,
);
router.post("/chat", validateAiChat, controller.chat);
router.get("/inventory-alerts", controller.getInventoryAlerts);
router.get("/daily-summary", branchMemberScope, controller.getDailySummary);
router.use(handleControllerError);

module.exports = router;
