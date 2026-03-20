const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middlewares/auth");
const Branch = require("../../models/Branch");
const User = require("../../models/users");
const Settings = require("../../models/settings");

// ── Guard: super-admin only ───────────────────────────────────
function superAdminOnly(req, res, next) {
  const role = req.user?.role;
  const branchId = req.user?.branchId;

  if (role !== "admin") {
    return res.status(403).json({ error: "Super-admin access only" });
  }

  const hasBranch =
    branchId !== null &&
    branchId !== undefined &&
    branchId !== "null" &&
    branchId !== "";

  if (hasBranch) {
    return res.status(403).json({ error: "Super-admin access only" });
  }

  next();
}

// ── GET /admin/branches  — list all branches ──────────────────
router.get("/branches", userAuth, superAdminOnly, async (req, res) => {
  try {
    const branches = await Branch.find()
      .populate("adminUser", "username role")
      .sort({ createdAt: -1 });
    res.json({ branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/branches  — create a branch ───────────────────
router.post("/branches", userAuth, superAdminOnly, async (req, res) => {
  try {
    const { name, address, phone, email, gstin } = req.body;
    if (!name)
      return res.status(400).json({ error: "Branch name is required" });

    const branch = await Branch.create({ name, address, phone, email, gstin });

    // Auto-create a default Settings document for this branch
    await Settings.create({
      branchId: branch._id,
      businessName: name,
      address,
      phone,
      gstin,
    });

    res.status(201).json({ message: "Branch created", branch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/branches/:id  — update branch info ─────────────
router.put("/branches/:id", userAuth, superAdminOnly, async (req, res) => {
  try {
    const { name, address, phone, email, gstin, isActive } = req.body;
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { name, address, phone, email, gstin, isActive },
      { new: true, runValidators: true },
    );
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    res.json({ message: "Branch updated", branch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /admin/branches/:id  — deactivate (soft delete) ────
router.delete("/branches/:id", userAuth, superAdminOnly, async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    res.json({ message: "Branch deactivated", branch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/branches/:id/assign-staff  — assign user to branch ──
// Body: { userId }
router.post(
  "/branches/:id/assign-staff",
  userAuth,
  superAdminOnly,
  async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const [branch, user] = await Promise.all([
        Branch.findById(req.params.id),
        User.findById(userId),
      ]);
      if (!branch) return res.status(404).json({ error: "Branch not found" });
      if (!user) return res.status(404).json({ error: "User not found" });

      // FIX: Prevent assigning a super-admin (branchless admin) to a branch
      if (user.role === "admin" && !user.branchId) {
        return res
          .status(400)
          .json({ error: "Cannot assign a super-admin to a branch" });
      }

      user.branchId = branch._id;
      await user.save({ validateBeforeSave: false });

      res.json({
        message: `${user.username} assigned to ${branch.name}`,
        user,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── POST /admin/branches/:id/remove-staff  — unassign user from branch ──
// Body: { userId }
router.post(
  "/branches/:id/remove-staff",
  userAuth,
  superAdminOnly,
  async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const user = await User.findOne({ _id: userId, branchId: req.params.id });
      if (!user) {
        return res.status(404).json({ error: "User not found in this branch" });
      }

      user.branchId = null;
      await user.save({ validateBeforeSave: false });

      res.json({ message: `${user.username} removed from branch`, user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /admin/branches/:id/staff  — list staff for a branch ──
router.get(
  "/branches/:id/staff",
  userAuth,
  superAdminOnly,
  async (req, res) => {
    try {
      const users = await User.find({ branchId: req.params.id })
        .select("-password")
        .sort({ role: 1 });
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /admin/branches/unassigned-staff  — users with no branch ──
router.get(
  "/branches/unassigned-staff",
  userAuth,
  superAdminOnly,
  async (req, res) => {
    try {
      const users = await User.find({
        branchId: null,
        role: { $ne: "admin" }, // exclude super-admins
      })
        .select("-password")
        .sort({ role: 1 });
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /admin/branches/:id/summary  — quick stats per branch ─
router.get(
  "/branches/:id/summary",
  userAuth,
  superAdminOnly,
  async (req, res) => {
    try {
      const Kot = require("../../models/kot");
      const branchId = req.params.id;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalOrders, activeOrders, staffCount] = await Promise.all([
        Kot.countDocuments({ branchId, createdAt: { $gte: today } }),
        Kot.countDocuments({
          branchId,
          status: { $in: ["pending", "preparing", "ready"] },
        }),
        User.countDocuments({ branchId, status: "active" }),
      ]);

      res.json({ totalOrders, activeOrders, staffCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = { adminBranchRouter: router };
