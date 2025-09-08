const express = require("express");
const bcrypt = require("bcrypt");
const authRouter = express.Router();
const User = require("../models/users");
const { validateSignupData } = require("../utils/validation");

authRouter.post("/signup", async (req, res) => {
  try {
    validateSignupData(req);
    const { username, role, password, status } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "username already exists" });
    }
    const safeRole =
      role && ["admin", "waiter", "chef"].includes(role) ? role : "waiter";

    const safeStatus =
      status && ["active", "locked"].includes(status) ? status : "active";

    const newUser = new User({
      username,
      role: safeRole,
      password: safeStatus,
      status,
    });
    await newUser.save();
    res.status(201).json({
      message: "User registered successfully",
      user: { id: newUser._id, username: newUser.username, role: newUser.role },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { authRouter };
