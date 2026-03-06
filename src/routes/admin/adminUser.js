const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const User = require("../../models/users");
const {
  validateSignupData,
  validateStatus,
  validateRole,
} = require("../../utils/validation");
const adminUserRouter = express.Router();

const ALLOWED_ROLES = ["admin", "chef", "waiter", "cashier", "manager"];

// ── CREATE — admin only ──────────────────────────────────────
adminUserRouter.post(
  "/create-user",
  userAuth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      validateSignupData(req.body);
      const { username, role, password, status } = req.body;
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: "username already exists" });
      }
      const safeRole = validateRole({ role });
      const safeStatus = validateStatus({ status });
      const newUser = new User({
        username,
        role: safeRole,
        password,
        status: safeStatus,
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
  userAuth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const users = await User.find().select("-password");
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
  userAuth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (!role) return res.status(400).json({ error: "Role is required" });
      if (!ALLOWED_ROLES.includes(role))
        return res.status(400).json({ error: "Invalid role" });
      if (!mongoose.Types.ObjectId.isValid(userId))
        return res.status(400).json({ error: "Invalid userId" });
      const user = await User.findByIdAndUpdate(
        userId,
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
  userAuth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId))
        return res.status(400).json({ error: "Invalid User Id" });
      const deletedUser = await User.findByIdAndDelete(userId);
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
