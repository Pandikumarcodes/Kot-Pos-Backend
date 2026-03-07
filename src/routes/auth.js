const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRouter = express.Router();
const User = require("../models/users");

const {
  validateSignupData,
  validateStatus,
  validateRole,
} = require("../utils/validation");

authRouter.post("/signup", async (req, res) => {
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

// ── LOGIN ───────────────────────────────────────────────────
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // ✅ Block inactive users
    if (user.status !== "active") {
      return res
        .status(403)
        .json({ error: "Your account is inactive. Contact admin." });
    }

    const token = await user.getJWT();
    res.cookie("token", token, {
      httpOnly: true,
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    });

    res.status(200).json({
      message: `${username} Login successful`,
      token,
      // ✅ Return user object so frontend doesn't need to decode JWT
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const payload = jwt.verify(token, "Pandi");

    const user = await User.findById(payload._id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.username,
        email: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// ── LOGOUT ──────────────────────────────────────────────────
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
