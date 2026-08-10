const express = require("express");
const { userAuth } = require("../../middlewares/auth");
const { requireSuperAdmin } = require("../../middlewares/branchScope");
const controller = require("../../controllers/branchController");
const { handleControllerError } = require("../../controllers/controllerUtils");
const {
  validateBranchCreate,
  validateBranchAdminAssignment,
  validateBranchAdminCreate,
  validateBranchId,
  validateBranchStaff,
  validateBranchUpdate,
} = require("../../validators/branches");

const router = express.Router();
router.get("/branches", userAuth, requireSuperAdmin, controller.listBranches);
router.post(
  "/branches",
  userAuth,
  requireSuperAdmin,
  validateBranchCreate,
  controller.createBranch,
);
router.put(
  "/branches/:id",
  userAuth,
  requireSuperAdmin,
  validateBranchUpdate,
  controller.updateBranch,
);
router.delete(
  "/branches/:id",
  userAuth,
  requireSuperAdmin,
  validateBranchId,
  controller.deactivateBranch,
);
router.post(
  "/branches/:id/assign-staff",
  userAuth,
  requireSuperAdmin,
  validateBranchStaff,
  controller.assignStaff,
);
router.post(
  "/branches/:id/assign-admin",
  userAuth,
  requireSuperAdmin,
  validateBranchAdminAssignment,
  controller.assignBranchAdmin,
);
router.post(
  "/branches/:id/admin",
  userAuth,
  requireSuperAdmin,
  validateBranchAdminCreate,
  controller.createBranchAdmin,
);
router.post(
  "/branches/:id/remove-staff",
  userAuth,
  requireSuperAdmin,
  validateBranchStaff,
  controller.removeStaff,
);
router.get(
  "/branches/:id/staff",
  userAuth,
  requireSuperAdmin,
  validateBranchId,
  controller.listBranchStaff,
);
router.get(
  "/branches/unassigned-staff",
  userAuth,
  requireSuperAdmin,
  controller.listUnassignedStaff,
);
router.get(
  "/branches/:id/summary",
  userAuth,
  requireSuperAdmin,
  validateBranchId,
  controller.getBranchSummary,
);
router.use(handleControllerError);

module.exports = { adminBranchRouter: router };
