const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const { requireBranch } = branchScope;
const User = require("../../models/users");
const {
  validateCreateUser,
  validateRoleUpdate,
  validateUserId,
} = require("../../validators/users");
const adminUserRouter = express.Router();

adminUserRouter.use(userAuth, branchScope);

// ── CREATE — admin only ──────────────────────────────────────
adminUserRouter.post(
  "/create-user",
  allowRoles(["admin"]),
  requireBranch,
  validateCreateUser,
  async (req, res) => {
    try {
      const { username, role, password, status } = req.body;
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: "username already exists" });
      }
      const newUser = new User({
        username,
        role,
        password,
        status,
        branchId: req.branchId,
      });
      await newUser.save();
      res.status(201).json({
        message: "New user created successfully",
        user: {
          id: newUser._id,
          username: newUser.username,
          role: newUser.role,
          status: newUser.status,
        },
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// ── GET ALL USERS — admin + manager ─────────────────────────
adminUserRouter.get(
  "/users",
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const users = await User.find(req.branchFilter).select("-password");
      if (!users.length) {
        return res.status(404).json({ error: "No users found" });
      }
      res.status(200).json({ users });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  },
);

// ── UPDATE ROLE — admin + manager ────────────────────────────
adminUserRouter.put(
  "/update-role/:userId",
  allowRoles(["admin", "manager"]),
  validateRoleUpdate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (req.user.role === "manager" && role === "admin") {
        return res.status(403).json({ error: "Managers cannot assign admin role" });
      }
      const user = await User.findOneAndUpdate(
        req.scopeToBranch({ _id: userId }),
        { role },
        { new: true, runValidators: true, select: "-password" },
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({
        message: "User role updated successfully",
        user: { id: user._id, username: user.username, newRole: user.role },
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to update user role" });
    }
  },
);

// ── DELETE — admin only ──────────────────────────────────────
adminUserRouter.delete(
  "/deleteUser/:userId",
  allowRoles(["admin"]),
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const deletedUser = await User.findOneAndDelete(
        req.scopeToBranch({ _id: userId }),
      );
      if (!deletedUser)
        return res.status(404).json({ error: "User not found" });
      return res.status(200).json({
        message: "User deleted successfully",
        user: { id: deletedUser._id, username: deletedUser.username },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = { adminUserRouter };
