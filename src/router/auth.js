const express = require("express");
const bcrypt = require("bcrypt");
const authRouter = express.Router();
const User = require("../models/users");
const {
  validateSignupData,
  validateStatus,
  validateRole,
} = require("../utils/validation");

authRouter.post("/signup", async (req, res) => {
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
      message: "User registered successfully",
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

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    console.log(user);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = await user.getJWT();
    res.cookie("token", token, {
      httpOnly: true,
      // expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });

    res.status(200).json({
      message: `${username} Login successful`,
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

authRouter.post("/logout", async (req, res) => {
  const { username } = req.body;
  try {
    res.cookie("token", null, {
      expires: new Date(Date.now()),
    });
    res.status(200).json({
      message: `${username} logout successful`,
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

module.exports = { authRouter };
