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

// Middleware: only admins can access these routes
adminUserRouter.use(userAuth, allowRoles(["admin"]));

adminUserRouter.post("/create-user", async (req, res) => {
  try {
    console.log("📥 BODY RECEIVED:", req.body);
    // Validate incoming data
    validateSignupData(req.body);

    const { username, role, password, status } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "username already exists" });
    }

    // ✅ Use utils directly
    const safeRole = validateRole({ role });
    const safeStatus = validateStatus({ status });

    // Create and save new user
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
});

adminUserRouter.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    if (!users.length) {
      return res.status(404).json({ error: "No users found" });
    }
    res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminUserRouter.put("/update-role/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    // Role Validation
    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }
    // Allwod Roled validation
    if (!ALLOWED_ROLES.includes(role))
      return res.status(400).json({ error: "Invalid role" });

    //Mongoose ObjectID Validaton
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true, select: "-password" }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "User role updated successfully",
      user: {
        id: user._id,
        username: user.username,
        newRole: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update user role" });
  }
});

adminUserRouter.delete("/deleteUser/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User Id" });
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "User deleted successfully",
      user: {
        id: deletedUser._id,
        username: deletedUser.username,
      },
    });
  } catch (err) {
    console.error(err); // show real error in console
    res.status(500).json({ error: err.message });
  }
});

module.exports = { adminUserRouter };
